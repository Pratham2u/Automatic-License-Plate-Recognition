import json
import os
from PIL import Image, ImageDraw, ImageFont

input_folder = 'Sample_Images'
output_folder = 'output_images'
json_file = 'output.json'

os.makedirs(output_folder, exist_ok=True)

# Loads system font or falls back to default
try:
    font = ImageFont.truetype("arial.ttf", size=14)
except:
    font = ImageFont.load_default()

with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# If your output.json is a list, iterate directly; otherwise, wrap in [data]
if isinstance(data, dict):
    entries = [data]
elif isinstance(data, list):
    entries = data
else:
    raise ValueError("Unknown JSON structure")

for entry in entries:
    img_name = entry['filename']
    img_path = os.path.join(input_folder, img_name)
    if not os.path.isfile(img_path):
        print(f"Image {img_path} not found, skipping.")
        continue

    img = Image.open(img_path)
    draw = ImageDraw.Draw(img)
    results = entry.get('results', [])

    for result in results:
        # License Plate box and annotation
        plate_box = result['box']
        plate_text = result['plate']
        draw.rectangle(
            [plate_box['xmin'], plate_box['ymin'], plate_box['xmax'], plate_box['ymax']],
            outline='teal', width=3
        )
        draw.text(
            (plate_box['xmin'], plate_box['ymin'] - 20),
            plate_text,
            fill='teal',
            font=font,
        )

        # Vehicle box and annotation (if present)
        vehicle_obj = result.get('vehicle', None)
        if vehicle_obj and 'box' in vehicle_obj:
            veh_box = vehicle_obj['box']
            veh_type = vehicle_obj.get('type', 'vehicle')
            veh_score = vehicle_obj.get('score', 0)
            draw.rectangle(
                [veh_box['xmin'], veh_box['ymin'], veh_box['xmax'], veh_box['ymax']],
                outline='red', width=2
            )
            veh_label = f"{veh_type} ({veh_score:.2f})"
            draw.text(
                (veh_box['xmin'], veh_box['ymin'] - 20),
                veh_label,
                fill='red',
                font=font,
            )

    out_path = os.path.join(output_folder, f"{os.path.splitext(img_name)[0]}_annotated.jpg")
    img.save(out_path)
    print(f"Saved: {out_path}")
