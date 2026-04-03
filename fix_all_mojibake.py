#!/usr/bin/env python3
with open('index.html', 'rb') as f:
    data = f.read()

# Comprehensive mojibake fixes
fixes = {
    # Punctuation
    b'\xc3\x83\xc2\xa2\xc3\x82\xc2\x80\xc3\x82\xc2\x94': b'\xe2\x80\x94',  # em dash —
    b'\xc3\x83\xc2\xa2\xc3\x82\xc2\x80\xc3\x82\xc2\x9a': b'\xe2\x80\x9a',  # arrow →
    b'\xc3\x83\xc2\xa2\xc3\x82\xc2\x82\xc3\x82\xc2\xac': b'\xe2\x82\xac',  # euro €
    b'\xc3\x83\xc2\x82\xc3\x82\xc2\xb7': b'\xc2\xb7',                      # middle dot ·
    b'\xc3\x82\xc2\xb7': b'\xc2\xb7',                                      # middle dot (shorter)
    
    # Special chars
    b'\xc3\x83\xc2\x82\xc3\x82\xc2\xa9': b'\xc2\xa9',  # copyright ©
    b'\xc3\x83\xc2\x82\xc3\x82\xc2\xb1': b'\xc2\xb1',  # plus-minus ±
    
    # French/Dutch chars
    b'C\xc3\x83\xc2\x82\xc3\x82\xc2\xb4te': b'C\xc3\xb4te',  # Côte
    b'\xc3\x83\xc2\x83\xc3\x82\xc2\xb4te': b'C\xc3\xb4te',   # Côte (variant)
    b'Cura\xc3\x83\xc2\x82\xc3\x82\xc2\xa7ao': b'Cura\xc3\xa7ao',  # Curaçao
    b'\xc3\x83\xc2\xa7ao': b'\xc3\xa7ao',  # çao
    
    # Emojis (common patterns)
    b'\xc3\x83\xc2\xb0\xc3\x82\xc2\x9f\xc3\x82\xc2\x8e\xc3\x82\xc2\xac': b'\xf0\x9f\x8e\xac',  # 🎬
    b'\xc3\x83\xc2\xb0\xc3\x82\xc2\x9f\xc3\x82\xc2\x8c\xc3\x82\xc2\x8a': b'\xf0\x9f\x8c\x8a',  # 🌊
    
    # Checkmark
    b'\xc3\x83\xc2\xa2\xc3\x82\xc2\x9c\xc3\x82\xc2\x93': b'\xe2\x9c\x93',  # ✓
}

total_fixed = 0
for old, new in fixes.items():
    count = data.count(old)
    if count > 0:
        total_fixed += count
        data = data.replace(old, new)

with open('index.html', 'wb') as f:
    f.write(data)

# Verify
text = data.decode('utf-8', errors='ignore')
print(f"Fixed {total_fixed} mojibake patterns")
print(f"Remaining 'Ã' count: {text.count('Ã')}")

# Show title
title = text[text.find('<title>')+7:text.find('</title>')]
print(f"Title: {title}")

# Show a Côte sample
if 'Côte' in text:
    print("✓ 'Côte d'Azur' is correct")
if 'Curaçao' in text:
    print("✓ 'Curaçao' is correct")
