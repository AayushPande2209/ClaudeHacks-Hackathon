import sys
from pathlib import Path
import csv
import io

# Add src to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from data.bom_loader import _normalize_uploaded_row

def test_reproduction():
    # Simulated row from user's screenshot
    raw_row = {
        "Item": "1",
        "Description": "Bottle Body",
        "Material": "Stainless Steel (304)",
        "Quantity": "1",
        "Unit Cost (USD)": "3.5",
        "Total Cost (USD)": "3.5",
        "Supplier": "ABC Metals",
        "Country": "China"
    }
    
    errors = []
    normalized = _normalize_uploaded_row(raw_row, 0, errors)
    
    print(f"Normalized row: {normalized}")
    print(f"Errors: {errors}")
    
    country = normalized.get("supplier_country")
    # Semicolon-separated row test with real parser
    from data.bom_loader import parse_bom_csv
    
    csv_data = (
        "Item;Description;Material;Quantity;Unit Cost (USD);Total Cost (USD);Supplier;Country\n"
        "1;Bottle Body;Stainless Steel (304);1;3.5;3.5;ABC Metals;China"
    ).encode("utf-8")
    
    parsed = parse_bom_csv(csv_data, filename="materials.csv")
    normalized_semi = parsed["rows"][0]
    
    print(f"Normalized semi-colon row via parse_bom_csv: {normalized_semi}")
    # Title row test (Excel style)
    csv_data_with_title = (
        "Water Bottle BOM\n"
        "\n"
        "Item,Description,Material,Quantity,Unit Cost (USD),Total Cost (USD),Supplier,Country\n"
        "1,Bottle Body,Stainless Steel (304),1,3.5,3.5,ABC Metals,China"
    ).encode("utf-8")
    
    parsed = parse_bom_csv(csv_data_with_title, filename="materials.csv")
    normalized_title = parsed["rows"][0]
    
    print(f"Normalized title row test: {normalized_title}")
    if normalized_title.get("supplier_country") == "China":
        print("SUCCESS: Leading title skip logic fixed the issue!")
    else:
        print(f"FAILURE: Country recognized as '{normalized_title.get('supplier_country')}'")

if __name__ == "__main__":
    test_reproduction()
