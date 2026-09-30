import os
import glob

html_files = glob.glob('*.html')
for file in html_files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # If the file contains double-encoded characters, we can fix them.
        # We test if it can be encoded to windows-1252 and then decoded to utf-8.
        # But we only want to do this if it actually HAS mojibake.
        # An easy check is if it has 'Ã' which is very common in UTF-8 -> ANSI mojibake.
        if 'Ã' in text:
            try:
                fixed_text = text.encode('windows-1252').decode('utf-8')
                with open(file, 'w', encoding='utf-8') as f:
                    f.write(fixed_text)
                print(f"Fixed {file}")
            except Exception as e:
                print(f"Failed to fix {file}: {e}")
        else:
            print(f"No fixing needed for {file}")
    except Exception as e:
        print(f"Error reading {file}: {e}")
