import json

# Wink 학습 데이터 확인
with open('backend/pose_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

wink_data = data.get('Wink', [])
print(f'Wink 데이터 개수: {len(wink_data)}')

if len(wink_data) > 0:
    # 첫 번째 샘플 확인
    first_sample = wink_data[0]
    print(f'\n첫 번째 샘플 길이: {len(first_sample)}')
    
    # 마지막 4개 값 확인 (눈 감음 상태: leftEyeEAR, rightEyeEAR, leftEyeClosed, rightEyeClosed)
    if len(first_sample) >= 4:
        last_4 = first_sample[-4:]
        print(f'마지막 4개 값 (눈 감음 상태): {last_4}')
        print(f'  - leftEyeEAR: {last_4[0]}')
        print(f'  - rightEyeEAR: {last_4[1]}')
        print(f'  - leftEyeClosed: {last_4[2]} (0=열림, 1=감음)')
        print(f'  - rightEyeClosed: {last_4[3]} (0=열림, 1=감음)')
    
    # 샘플 10개 확인
    print(f'\n샘플 10개 확인:')
    for i in range(min(10, len(wink_data))):
        sample = wink_data[i]
        if len(sample) >= 4:
            last_4 = sample[-4:]
            left_closed = last_4[2]
            right_closed = last_4[3]
            print(f'샘플 {i+1}: 길이={len(sample)}, leftEyeClosed={left_closed}, rightEyeClosed={right_closed}')
        else:
            print(f'샘플 {i+1}: 길이={len(sample)} (눈 감음 정보 없음 - 구버전 데이터)')
    
    # 눈 감은 샘플이 있는지 확인
    closed_samples = 0
    for sample in wink_data:
        if len(sample) >= 4:
            last_4 = sample[-4:]
            if last_4[2] == 1 or last_4[3] == 1:  # leftEyeClosed 또는 rightEyeClosed가 1
                closed_samples += 1
    
    print(f'\n눈 감은 샘플 개수: {closed_samples} / {len(wink_data)}')
    if closed_samples == 0:
        print('⚠️ 경고: 눈 감은 샘플이 없습니다! 모두 눈 뜬 상태로 학습되었을 가능성이 있습니다.')
else:
    print('Wink 데이터가 없습니다.')

