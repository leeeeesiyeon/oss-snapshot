# -*- coding: utf-8 -*-
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
data_file = os.path.join(script_dir, 'pose_data.json')

if os.path.exists(data_file):
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("=" * 60)
    print("학습된 포즈별 샘플 개수")
    print("=" * 60)
    
    total_samples = 0
    for pose_name in sorted(data.keys()):
        count = len(data[pose_name])
        total_samples += count
        print(f"  {pose_name:15s}: {count:5d}개 샘플")
    
    print("=" * 60)
    print(f"총 {len(data)}개 포즈, 총 {total_samples}개 샘플")
    print("=" * 60)
else:
    print(f"❌ {data_file} 파일을 찾을 수 없습니다.")

