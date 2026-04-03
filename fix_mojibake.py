#!/usr/bin/env python3
# Fix triple-encoded UTF-8 mojibake in index.html

with open('index.html', 'rb') as f:
    data = f.read()

# Known bad byte sequences → correct UTF-8
fixes = {
    # Em dash (—)
    b'\xc3\x83\xc2\xa2\xc3\x82\xc2\x80\xc3\x82\xc2\x94': b'\xe2\x80\x94',
    # Euro (€)  
    b'\xc3\x83\xc2\xa2\xc3\x82\xc2\x82\xc3\x82\xc2\xac': b'\xe2\x82\xac',
    # Côte
    b'C\xc3\x83\xc2\x82\xc3\x82\xc2\xb4te': b'C\xc3\xb4te',
    # Curaçao
    b'Cura\xc3\x83\xc2\x82\xc3\x82\xc2\xa7ao': b'Cura\xc3\xa7ao',
    # Copyright ©
    b'\xc3\x83\xc2\x82\xc3\x82\xc2\xa9': b'\xc2\xa9',
    # Plus-minus ±
    b'\xc3\x83\xc2\x82\xc3\x82\xc2\xb1': b'\xc2\xb1',
    # Middle dot ·
    b'\xc3\x82\xc2\xb7': b'\xc2\xb7',
}

for old, new in fixes.items():
    count = data.count(old)
    if count > 0:
        print(f"Replacing {count} instances of {old[:20]}...")
        data = data.replace(old, new)

with open('index.html', 'wb') as f:
    f.write(data)

# Verify
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()
    title = text[text.find('<title>')+7:text.find('</title>')]
    print(f"\nTitle after fix: {title}")
    print(f"Remaining 'Ã' characters: {text.count('Ã')}")
