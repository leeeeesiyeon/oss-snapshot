import json

with open('backend/pose_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 50)
print("학습된 포즈별 개수:")
print("=" * 50)
total = 0
for pose, features_list in data.items():
    count = len(features_list)
    total += count
    print(f"{pose}: {count}개")

print("=" * 50)
print(f"총 데이터 개수: {total}개")
print("=" * 50)

