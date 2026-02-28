# import json

# print("Fixing whitespace in sentences_with_embeddings.json...")

# with open('scripts/output/sentences_with_embeddings.json', 'r', encoding='utf-8') as f:
#     sentences = json.load(f)

# with open('scripts/output/talks.json', 'r', encoding='utf-8') as f:
#     talks = json.load(f)

# # Build a lookup of url -> clean speaker name
# speaker_lookup = {talk['url']: talk['speaker'] for talk in talks}

# # Update speaker names in sentences
# for sentence in sentences:
#     url = sentence.get('url')
#     if url and url in speaker_lookup:
#         sentence['speaker'] = speaker_lookup[url]

# with open('scripts/output/sentences_with_embeddings.json', 'w', encoding='utf-8') as f:
#     json.dump(sentences, f, indent=2, ensure_ascii=False)

# print(f"Updated {len(sentences)} sentences")

import json

with open('scripts/output/sentences_with_embeddings.json', 'r', encoding='utf-8') as f:
    sentences = json.load(f)

def clean_speaker(name):
    name = name.replace('\xa0', ' ')  # non-breaking space
    name = name.replace('By ', '').replace('Presented by ', '')
    return name.strip()

for sentence in sentences:
    if 'speaker' in sentence:
        sentence['speaker'] = clean_speaker(sentence['speaker'])

with open('scripts/output/sentences_with_embeddings.json', 'w', encoding='utf-8') as f:
    json.dump(sentences, f, indent=2, ensure_ascii=False)

print(f"Updated {len(sentences)} sentences")

# Verify
sample = [s for s in sentences if 'Nelson' in s.get('speaker', '')]
if sample:
    print(repr(sample[0]['speaker']))