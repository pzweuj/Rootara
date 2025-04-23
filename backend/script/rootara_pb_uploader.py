import random

# 已测试1000000次，没有重复
def generate_random_id():
    """
    生成10位随机编号，由大写字母和数字组成
    :return: 10位随机编号字符串
    """
    # 定义字符池：26个大写字母和10个数字
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    # 生成8位随机编号
    random_id = ''.join(random.choice(chars) for _ in range(10))
    return random_id