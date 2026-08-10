"""Evaluate the MySihat habit Random Forest (regression + top-1 habit ranking)."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import partial_dependence, permutation_importance
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_fscore_support,
    r2_score,
)
from sklearn.model_selection import KFold, cross_val_predict, train_test_split
from sklearn.multioutput import MultiOutputRegressor

from train_random_forest import FEATURE_NAMES, HABIT_IDS, sample_row, teacher_scores

REPORT_PATH = Path(__file__).resolve().parent / "rf_evaluation_report.json"
N_SAMPLES = 4000
RANDOM_STATE = 47


def build_dataset(n: int = N_SAMPLES) -> tuple[np.ndarray, np.ndarray]:
    X = np.zeros((n, len(FEATURE_NAMES)), dtype=np.float64)
    Y = np.zeros((n, len(HABIT_IDS)), dtype=np.float64)
    for i in range(n):
        row = sample_row()
        X[i] = [row[name] for name in FEATURE_NAMES]
        Y[i] = teacher_scores(row)
    return X, Y


def make_model(*, oob: bool = False) -> MultiOutputRegressor:
    return MultiOutputRegressor(
        RandomForestRegressor(
            n_estimators=40,
            max_depth=8,
            min_samples_leaf=8,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            oob_score=oob,
            bootstrap=True,
        )
    )


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    overall = {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "mse": float(mean_squared_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }
    per_habit = {}
    for i, habit in enumerate(HABIT_IDS):
        per_habit[habit] = {
            "mae": float(mean_absolute_error(y_true[:, i], y_pred[:, i])),
            "mse": float(mean_squared_error(y_true[:, i], y_pred[:, i])),
            "rmse": float(np.sqrt(mean_squared_error(y_true[:, i], y_pred[:, i]))),
            "r2": float(r2_score(y_true[:, i], y_pred[:, i])),
        }
    return {"overall": overall, "per_habit": per_habit}


def top1_classification_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    true_top = np.argmax(y_true, axis=1)
    pred_top = np.argmax(y_pred, axis=1)
    labels = list(range(len(HABIT_IDS)))
    precision, recall, f1, support = precision_recall_fscore_support(
        true_top,
        pred_top,
        labels=labels,
        average=None,
        zero_division=0,
    )
    cm = confusion_matrix(true_top, pred_top, labels=labels)
    return {
        "accuracy": float(accuracy_score(true_top, pred_top)),
        "macro_precision": float(np.mean(precision)),
        "macro_recall": float(np.mean(recall)),
        "macro_f1": float(np.mean(f1)),
        "per_habit": {
            HABIT_IDS[i]: {
                "precision": float(precision[i]),
                "recall": float(recall[i]),
                "f1": float(f1[i]),
                "support": int(support[i]),
            }
            for i in labels
        },
        "confusion_matrix": {
            "labels": HABIT_IDS,
            "matrix": cm.tolist(),
        },
    }


def feature_importance(model: MultiOutputRegressor, X: np.ndarray, Y: np.ndarray) -> dict:
    # Mean impurity importance across the 7 habit forests.
    impurity = np.zeros(len(FEATURE_NAMES), dtype=np.float64)
    for estimator in model.estimators_:
        impurity += estimator.feature_importances_
    impurity /= max(len(model.estimators_), 1)

    # Permutation importance on a hold-out slice (more trustworthy).
    perm = permutation_importance(
        model,
        X,
        Y,
        n_repeats=5,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        scoring="neg_mean_absolute_error",
    )

    ranked_impurity = sorted(
        (
            {"feature": FEATURE_NAMES[i], "importance": float(impurity[i])}
            for i in range(len(FEATURE_NAMES))
        ),
        key=lambda row: row["importance"],
        reverse=True,
    )
    ranked_perm = sorted(
        (
            {
                "feature": FEATURE_NAMES[i],
                "importance_mean": float(perm.importances_mean[i]),
                "importance_std": float(perm.importances_std[i]),
            }
            for i in range(len(FEATURE_NAMES))
        ),
        key=lambda row: row["importance_mean"],
        reverse=True,
    )
    return {
        "impurity_importance": ranked_impurity,
        "permutation_importance": ranked_perm,
    }


def oob_metrics(X: np.ndarray, Y: np.ndarray) -> dict:
    model = make_model(oob=True)
    model.fit(X, Y)
    per_habit = {}
    oob_scores = []
    for i, habit in enumerate(HABIT_IDS):
        est = model.estimators_[i]
        score = float(est.oob_score_) if est.oob_score_ is not None else float("nan")
        oob_scores.append(score)
        per_habit[habit] = {"oob_r2": score}
    return {
        "mean_oob_r2": float(np.nanmean(oob_scores)),
        "per_habit": per_habit,
        "note": "OOB R² from bootstrap left-out samples (built-in RF validation).",
    }


def cross_validation_metrics(X: np.ndarray, Y: np.ndarray, folds: int = 5) -> dict:
    model = make_model(oob=False)
    cv = KFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
    preds = cross_val_predict(model, X, Y, cv=cv, n_jobs=-1)
    metrics = regression_metrics(Y, preds)
    top1 = top1_classification_metrics(Y, preds)
    return {
        "folds": folds,
        "regression": metrics,
        "top1_habit": {
            "accuracy": top1["accuracy"],
            "macro_f1": top1["macro_f1"],
        },
    }


def partial_dependence_snippets(model: MultiOutputRegressor, X: np.ndarray) -> dict:
    """Small PD curves for key feature→habit pairs that should match domain logic."""
    pairs = [
        ("smoking", "smoke_free_day"),
        ("sleep_hours", "sleep_7"),
        ("activity_low", "walk_20"),
        ("diet_unhealthy", "no_sugary_drink"),
    ]
    out = {}
    for feature, habit in pairs:
        feature_idx = FEATURE_NAMES.index(feature)
        habit_idx = HABIT_IDS.index(habit)
        # MultiOutputRegressor exposes .estimators_[habit]; PD on that estimator.
        est = model.estimators_[habit_idx]
        pd = partial_dependence(
            est,
            X,
            features=[feature_idx],
            kind="average",
            grid_resolution=20,
        )
        # sklearn >=1.4 returns Bunch with 'grid_values' / 'average'
        grid = pd["grid_values"][0]
        avg = pd["average"][0]
        out[f"{feature}→{habit}"] = {
            "feature_values": [float(v) for v in np.asarray(grid).ravel()],
            "average_prediction": [float(v) for v in np.asarray(avg).ravel()],
            "direction_check": (
                "higher smoking should raise smoke_free_day"
                if feature == "smoking"
                else "sleep far from 7-8 should raise sleep_7"
                if feature == "sleep_hours"
                else "domain-aligned check"
            ),
        }
    return out


def try_shap(model: MultiOutputRegressor, X: np.ndarray) -> dict:
    try:
        import shap  # type: ignore
    except ImportError:
        return {
            "available": False,
            "note": "Install shap (`pip install shap`) to compute SHAP values. "
            "Permutation importance above is the lightweight alternative.",
        }

    # Explain one habit forest (smoke_free_day) on a sample for readability.
    habit_idx = HABIT_IDS.index("smoke_free_day")
    est = model.estimators_[habit_idx]
    sample = X[:200]
    explainer = shap.TreeExplainer(est)
    values = explainer.shap_values(sample)
    mean_abs = np.mean(np.abs(values), axis=0)
    ranked = sorted(
        (
            {"feature": FEATURE_NAMES[i], "mean_abs_shap": float(mean_abs[i])}
            for i in range(len(FEATURE_NAMES))
        ),
        key=lambda row: row["mean_abs_shap"],
        reverse=True,
    )
    return {
        "available": True,
        "habit": "smoke_free_day",
        "sample_size": int(sample.shape[0]),
        "mean_abs_shap_ranked": ranked,
    }


def print_report(report: dict) -> None:
    reg = report["holdout_regression"]["overall"]
    top1 = report["holdout_top1_habit"]
    oob = report["oob"]
    cv = report["cross_validation"]
    print("\n========== MySihat RF evaluation ==========")
    print("Task type: multi-output REGRESSION (habit scores)")
    print("Also reported: top-1 habit as a CLASSIFICATION view\n")

    print("--- Hold-out regression ---")
    print(f"MAE  = {reg['mae']:.4f}")
    print(f"MSE  = {reg['mse']:.4f}")
    print(f"RMSE = {reg['rmse']:.4f}")
    print(f"R²   = {reg['r2']:.4f}")

    print("\n--- OOB (built-in RF validation) ---")
    print(f"Mean OOB R² = {oob['mean_oob_r2']:.4f}")

    print("\n--- 5-fold cross-validation ---")
    print(f"CV MAE = {cv['regression']['overall']['mae']:.4f}")
    print(f"CV R²  = {cv['regression']['overall']['r2']:.4f}")
    print(f"CV top-1 accuracy = {cv['top1_habit']['accuracy']:.3f}")
    print(f"CV top-1 macro-F1 = {cv['top1_habit']['macro_f1']:.3f}")

    print("\n--- Top-1 habit classification (hold-out) ---")
    print(f"Accuracy = {top1['accuracy']:.3f}")
    print(f"Macro precision = {top1['macro_precision']:.3f}")
    print(f"Macro recall    = {top1['macro_recall']:.3f}")
    print(f"Macro F1        = {top1['macro_f1']:.3f}")

    print("\nConfusion matrix (rows=true, cols=pred):")
    labels = top1["confusion_matrix"]["labels"]
    matrix = top1["confusion_matrix"]["matrix"]
    header = " ".join(f"{h[:8]:>8}" for h in labels)
    print(f"{'':8} {header}")
    for label, row in zip(labels, matrix):
        print(f"{label[:8]:>8} " + " ".join(f"{v:8d}" for v in row))

    print("\n--- Feature importance (top 8, permutation) ---")
    for row in report["feature_importance"]["permutation_importance"][:8]:
        print(
            f"  {row['feature']:<22} "
            f"mean={row['importance_mean']:.4f} ± {row['importance_std']:.4f}"
        )

    print("\n--- Partial dependence sanity checks ---")
    for key, curve in report["partial_dependence"].items():
        y0 = curve["average_prediction"][0]
        y1 = curve["average_prediction"][-1]
        print(
            f"  {key}: pred@{curve['feature_values'][0]:.2f}={y0:.3f} -> "
            f"@{curve['feature_values'][-1]:.2f}={y1:.3f}"
        )

    shap = report["shap"]
    print("\n--- SHAP ---")
    if not shap.get("available"):
        print(f"  {shap.get('note')}")
    else:
        print(f"  Habit={shap['habit']} sample={shap['sample_size']}")
        for row in shap["mean_abs_shap_ranked"][:5]:
            print(f"  {row['feature']:<22} mean|SHAP|={row['mean_abs_shap']:.4f}")

    print(f"\nWrote JSON report → {REPORT_PATH}")
    print("==========================================\n")


def main() -> None:
    print(f"Building {N_SAMPLES} synthetic profiles…")
    X, Y = build_dataset(N_SAMPLES)
    X_train, X_test, Y_train, Y_test = train_test_split(
        X, Y, test_size=0.2, random_state=RANDOM_STATE
    )

    print("Fitting model…")
    model = make_model(oob=False)
    model.fit(X_train, Y_train)
    pred = model.predict(X_test)

    print("Computing OOB / CV / importance / PDP…")
    report = {
        "model": {
            "algorithm": "RandomForestRegressor + MultiOutputRegressor",
            "n_estimators": 40,
            "max_depth": 8,
            "train_samples": int(X_train.shape[0]),
            "test_samples": int(X_test.shape[0]),
            "habits": HABIT_IDS,
            "features": FEATURE_NAMES,
        },
        "note": (
            "Labels are synthetic teacher scores, not clinical outcomes. "
            "Metrics measure how well RF reproduces those ranking rules."
        ),
        "holdout_regression": regression_metrics(Y_test, pred),
        "holdout_top1_habit": top1_classification_metrics(Y_test, pred),
        "oob": oob_metrics(X_train, Y_train),
        "cross_validation": cross_validation_metrics(X, Y, folds=5),
        "feature_importance": feature_importance(model, X_test, Y_test),
        "partial_dependence": partial_dependence_snippets(model, X_train),
        "shap": try_shap(model, X_train),
    }

    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print_report(report)


if __name__ == "__main__":
    main()
