import json
import codecs

with codecs.open('notebooks/02_ModelEvaluation_&_Face_Detection.ipynb', 'r', encoding='utf-8', errors='ignore') as f:
    nb = json.load(f)

code_cells = [c for c in nb['cells'] if c['cell_type'] == 'code']

# User asked for cell 19 and 20, let's print them (0-indexed 18 and 19)
print("Cell 19:")
if len(code_cells) > 18:
    print(''.join(code_cells[18]['source']))
else:
    print("No cell 19")

print("\n----------------\nCell 20:")
if len(code_cells) > 19:
    print(''.join(code_cells[19]['source']))
else:
    print("No cell 20")
