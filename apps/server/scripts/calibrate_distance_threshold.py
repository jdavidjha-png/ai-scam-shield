import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from services.embedding_service import get_embedding_model  # noqa: E402


def load_sms_dataset(path: Path) -> tuple[list[str], list[str]]:
    spam: set[str] = set()
    ham: set[str] = set()

    with path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            parts = line.rstrip("\n").split("\t", 1)
            if len(parts) != 2:
                print(f"Skipping malformed line {line_number}", file=sys.stderr)
                continue

            label, text = parts
            clean_text = text.strip()
            if not clean_text:
                continue
            if label == "spam":
                spam.add(clean_text)
            elif label == "ham":
                ham.add(clean_text)

    return sorted(spam), sorted(ham)


def nearest_l2_distances(
    validation_vectors: np.ndarray,
    training_vectors: np.ndarray,
    chunk_size: int = 512,
) -> np.ndarray:
    """Compute exact nearest L2 distances for normalized vectors in chunks."""
    distances: list[np.ndarray] = []
    for start in range(0, len(validation_vectors), chunk_size):
        batch = validation_vectors[start : start + chunk_size]
        maximum_cosine = np.max(batch @ training_vectors.T, axis=1)
        # For normalized vectors: ||a-b||² = 2 - 2(a·b).
        distances.append(np.sqrt(np.maximum(0.0, 2.0 - 2.0 * maximum_cosine)))
    return np.concatenate(distances)


def metrics_at_threshold(
    labels: np.ndarray,
    distances: np.ndarray,
    threshold: float,
) -> dict[str, float]:
    predictions = distances <= threshold
    true_positive = int(np.sum(predictions & (labels == 1)))
    false_positive = int(np.sum(predictions & (labels == 0)))
    false_negative = int(np.sum(~predictions & (labels == 1)))
    true_negative = int(np.sum(~predictions & (labels == 0)))

    precision = true_positive / (true_positive + false_positive) if predictions.any() else 0.0
    recall = true_positive / (true_positive + false_negative) if labels.any() else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )
    return {
        "threshold": round(threshold, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "true_positive": true_positive,
        "false_positive": false_positive,
        "true_negative": true_negative,
        "false_negative": false_negative,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Calibrate a scam-similarity L2 threshold on held-out SMS data."
    )
    parser.add_argument(
        "dataset",
        nargs="?",
        type=Path,
        default=SERVER_DIR / "data" / "SMSSpamCollection",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--validation-spam-fraction", type=float, default=0.2)
    parser.add_argument("--minimum-recall", type=float, default=0.9)
    parser.add_argument(
        "--output",
        type=Path,
        default=SERVER_DIR / "data" / "distance_calibration.json",
    )
    args = parser.parse_args()

    if not 0 < args.validation_spam_fraction < 1:
        parser.error("--validation-spam-fraction must be between 0 and 1")
    if not 0 < args.minimum_recall <= 1:
        parser.error("--minimum-recall must be between 0 and 1")

    spam, ham = load_sms_dataset(args.dataset.resolve())
    random.Random(args.seed).shuffle(spam)
    validation_count = max(1, round(len(spam) * args.validation_spam_fraction))
    validation_spam = spam[:validation_count]
    training_spam = spam[validation_count:]

    print(
        f"Unique messages: {len(training_spam)} training spam, "
        f"{len(validation_spam)} validation spam, {len(ham)} validation ham"
    )

    model = get_embedding_model()
    training_vectors = model.encode(
        training_spam,
        batch_size=64,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=True,
    )
    validation_texts = validation_spam + ham
    validation_vectors = model.encode(
        validation_texts,
        batch_size=64,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=True,
    )
    labels = np.array([1] * len(validation_spam) + [0] * len(ham))
    distances = nearest_l2_distances(validation_vectors, training_vectors)

    candidates = [
        metrics_at_threshold(labels, distances, float(threshold))
        for threshold in np.linspace(0.0, 2.0, 401)
    ]
    best_f1 = max(candidates, key=lambda item: item["f1"])
    recall_candidates = [
        item for item in candidates if item["recall"] >= args.minimum_recall
    ]
    recommended = max(
        recall_candidates,
        key=lambda item: (item["precision"], item["f1"], -item["threshold"]),
    )

    spam_distances = distances[labels == 1]
    ham_distances = distances[labels == 0]
    report = {
        "method": "held-out exact nearest-neighbor L2 on normalized embeddings",
        "seed": args.seed,
        "training_spam_count": len(training_spam),
        "validation_spam_count": len(validation_spam),
        "validation_ham_count": len(ham),
        "minimum_recall_target": args.minimum_recall,
        "recommended": recommended,
        "best_f1": best_f1,
        "distance_quantiles": {
            "spam": {
                str(q): round(float(np.quantile(spam_distances, q)), 4)
                for q in (0.1, 0.25, 0.5, 0.75, 0.9)
            },
            "ham": {
                str(q): round(float(np.quantile(ham_distances, q)), 4)
                for q in (0.1, 0.25, 0.5, 0.75, 0.9)
            },
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Saved calibration report to {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
