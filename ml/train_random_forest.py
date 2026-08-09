"""
Train a Random Forest that ranks daily habits from questionnaire features.

Run from repo:
  cd backend/ml
  python -m pip install -r requirements.txt
  python train_random_forest.py

Writes: ../src/data/random_forest_habits.json
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.multioutput import MultiOutputRegressor

HABIT_IDS = [
    "walk_20",
    "drink_water",
    "no_sugary_drink",
    "brown_rice_meal",
    "smoke_free_day",
    "sleep_7",
    "check_bp_reminder",
]

FEATURE_NAMES = [
    "age",
    "gender_male",
    "activity_low",
    "activity_moderate",
    "activity_high",
    "diet_unhealthy",
    "diet_average",
    "diet_healthy",
    "smoking",
    "bmi",
    "alcohol_none",
    "alcohol_occasional",
    "alcohol_regular",
    "sleep_hours",
    "high_bp",
    "health_age_delta",
]

OUT_PATH = Path(__file__).resolve().parents[1] / "src" / "data" / "random_forest_habits.json"
RNG = random.Random(47)
NP_RNG = np.random.default_rng(47)


def teacher_scores(row: dict[str, float]) -> list[float]:
    """Domain teacher labels the RF learns to approximate (synthetic ground truth)."""
    scores = {h: 0.15 for h in HABIT_IDS}

    if row["activity_low"] > 0.5:
        scores["walk_20"] += 0.55
    elif row["activity_moderate"] > 0.5:
        scores["walk_20"] += 0.25

    if row["diet_unhealthy"] > 0.5:
        scores["no_sugary_drink"] += 0.45
        scores["brown_rice_meal"] += 0.4
        scores["drink_water"] += 0.2
    elif row["diet_average"] > 0.5:
        scores["no_sugary_drink"] += 0.2
        scores["brown_rice_meal"] += 0.15

    if row["smoking"] > 0.5:
        scores["smoke_free_day"] += 0.7
    else:
        scores["smoke_free_day"] -= 0.35

    if row["sleep_hours"] < 7 or row["sleep_hours"] > 9:
        scores["sleep_7"] += 0.5
    else:
        scores["sleep_7"] += 0.05

    if row["high_bp"] > 0.5 or row["age"] >= 45:
        scores["check_bp_reminder"] += 0.35

    if row["bmi"] >= 25:
        scores["walk_20"] += 0.15
        scores["no_sugary_drink"] += 0.1
        scores["brown_rice_meal"] += 0.1

    if row["alcohol_regular"] > 0.5:
        scores["drink_water"] += 0.25
        scores["sleep_7"] += 0.1

    if row["health_age_delta"] >= 3:
        scores["walk_20"] += 0.1
        scores["sleep_7"] += 0.1

    # Tiny noise so the forest isn't a perfect memoriser of the teacher.
    return [float(np.clip(scores[h] + NP_RNG.normal(0, 0.03), 0.0, 1.0)) for h in HABIT_IDS]


def sample_row() -> dict[str, float]:
    age = RNG.randint(18, 75)
    gender_male = 1.0 if RNG.random() < 0.55 else 0.0
    activity = RNG.choices(["low", "moderate", "high"], weights=[0.4, 0.4, 0.2], k=1)[0]
    diet = RNG.choices(["unhealthy", "average", "healthy"], weights=[0.35, 0.4, 0.25], k=1)[0]
    smoking = 1.0 if RNG.random() < 0.28 else 0.0
    bmi = float(np.clip(NP_RNG.normal(26, 4), 17, 42))
    alcohol = RNG.choices(["none", "occasional", "regular"], weights=[0.55, 0.3, 0.15], k=1)[0]
    sleep_hours = float(np.clip(NP_RNG.normal(6.8, 1.4), 3, 12))
    high_bp = 1.0 if (age >= 50 and RNG.random() < 0.35) or RNG.random() < 0.12 else 0.0
    health_age_delta = float(np.clip(NP_RNG.normal(2 if smoking or activity == "low" else 0, 3), -8, 15))

    return {
        "age": float(age),
        "gender_male": gender_male,
        "activity_low": 1.0 if activity == "low" else 0.0,
        "activity_moderate": 1.0 if activity == "moderate" else 0.0,
        "activity_high": 1.0 if activity == "high" else 0.0,
        "diet_unhealthy": 1.0 if diet == "unhealthy" else 0.0,
        "diet_average": 1.0 if diet == "average" else 0.0,
        "diet_healthy": 1.0 if diet == "healthy" else 0.0,
        "smoking": smoking,
        "bmi": bmi,
        "alcohol_none": 1.0 if alcohol == "none" else 0.0,
        "alcohol_occasional": 1.0 if alcohol == "occasional" else 0.0,
        "alcohol_regular": 1.0 if alcohol == "regular" else 0.0,
        "sleep_hours": sleep_hours,
        "high_bp": high_bp,
        "health_age_delta": health_age_delta,
    }


def export_tree(tree) -> dict:
    t = tree.tree_
    return {
        "children_left": t.children_left.tolist(),
        "children_right": t.children_right.tolist(),
        "feature": t.feature.tolist(),
        "threshold": t.threshold.tolist(),
        "value": [float(v[0][0]) for v in t.value],
    }


def main() -> None:
    n = 4000
    X = np.zeros((n, len(FEATURE_NAMES)), dtype=np.float64)
    Y = np.zeros((n, len(HABIT_IDS)), dtype=np.float64)
    for i in range(n):
        row = sample_row()
        X[i] = [row[name] for name in FEATURE_NAMES]
        Y[i] = teacher_scores(row)

    model = MultiOutputRegressor(
        RandomForestRegressor(
            n_estimators=40,
            max_depth=8,
            min_samples_leaf=8,
            random_state=47,
            n_jobs=-1,
        )
    )
    model.fit(X, Y)

    # Hold-out style check on a small batch.
    test_rows = [sample_row() for _ in range(200)]
    Xt = np.array([[r[n] for n in FEATURE_NAMES] for r in test_rows])
    Yt = np.array([teacher_scores(r) for r in test_rows])
    pred = model.predict(Xt)
    mae = float(np.mean(np.abs(pred - Yt)))
    # Top-1 habit agreement rate.
    agree = float(np.mean(np.argmax(pred, axis=1) == np.argmax(Yt, axis=1)))

    forests = []
    for estimator in model.estimators_:
        forests.append([export_tree(tree) for tree in estimator.estimators_])

    payload = {
        "version": 1,
        "algorithm": "sklearn.ensemble.RandomForestRegressor + MultiOutputRegressor",
        "habit_ids": HABIT_IDS,
        "feature_names": FEATURE_NAMES,
        "n_estimators": 40,
        "max_depth": 8,
        "train_samples": n,
        "metrics": {"mae": mae, "top1_habit_agreement": agree},
        "forests": forests,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")
    print(f"MAE={mae:.4f} top1_agreement={agree:.3f}")


if __name__ == "__main__":
    main()
