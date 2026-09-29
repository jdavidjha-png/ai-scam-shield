import csv
from pathlib import Path

source = Path("data/SMSSpamCollection")
destination = Path("data/scam_dataset.csv")

with source.open(encoding="utf-8") as input_file, \
     destination.open("w", newline="", encoding="utf-8") as output_file:

    writer = csv.writer(output_file)
    writer.writerow(["text", "category"])

    for line in input_file:
        parts = line.rstrip("\n").split("\t", 1)

        if len(parts) != 2:
            continue

        label, text = parts

        # Only known spam belongs in the scam knowledge base.
        if label.lower() == "spam":
            writer.writerow([text, "OTHER"])

print(f"Created: {destination}")