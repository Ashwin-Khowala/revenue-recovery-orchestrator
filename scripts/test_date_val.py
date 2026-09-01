import re
import difflib
from datetime import datetime

MONTH_DAYS = {1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}
MONTH_CANONICAL = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
    7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'
}
STANDARD_MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
]
MONTH_MAP = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12
}

def resolve_month(token: str):
    token = token.lower().strip()
    if token in MONTH_MAP:
        return MONTH_MAP[token]
    matches = difflib.get_close_matches(token, STANDARD_MONTH_NAMES, n=1, cutoff=0.55)
    if matches:
        return MONTH_MAP[matches[0]]
    return None

def validate_promised_date(date_str: str) -> tuple[bool, str]:
    clean = str(date_str).lower().strip()
    if not clean or clean in ('0', 'none', 'null', 'undefined', 'rubbish', 'garbage', 'xyz', 'abc'):
        return False, 'Unrecognized or empty date format.'

    # 1. Check relative date keywords (when no digits present)
    rel_keywords = ['today', 'tomorrow', 'tonight', 'next', 'monday', 'tuesday', 'wednesday',
                    'thursday', 'friday', 'saturday', 'sunday', 'week', 'month', 'days', 'kal', 'parso', 'somwar', 'mangalwar']
    if any(k in clean for k in rel_keywords) and not re.search(r'\d+', clean):
        return True, date_str.strip().title()

    # 2. Check for numeric day + month name or month name + numeric day (e.g. '0 janu', '31 september', 'januaury 0', '15 oct')
    m1 = re.search(r'(\d+)(?:st|nd|rd|th)?\s+(?:of\s+)?([a-zA-Z]+)', clean)
    m2 = re.search(r'([a-zA-Z]+)\s+(\d+)(?:st|nd|rd|th)?', clean)
    
    day = None
    m_num = None
    if m1:
        d_val = int(m1.group(1))
        m_cand = resolve_month(m1.group(2))
        if m_cand:
            day, m_num = d_val, m_cand
    if not m_num and m2:
        m_cand = resolve_month(m2.group(1))
        d_val = int(m2.group(2))
        if m_cand:
            day, m_num = d_val, m_cand

    if day is not None and m_num is not None:
        m_name = MONTH_CANONICAL[m_num]
        if day <= 0:
            return False, f'Invalid day of month ({day} is not a valid calendar day).'
        max_d = MONTH_DAYS[m_num]
        if day > max_d:
            return False, f'Invalid calendar date: {m_name} has only {max_d} days.'
        return True, f'{day} {m_name}'

    # 3. Handle '15 tarikh' or 'tarikh 15'
    tarikh_match = re.search(r'(?:tarikh\s+(\d+)|(\d+)\s+tarikh)', clean)
    if tarikh_match:
        d_val = int(tarikh_match.group(1) or tarikh_match.group(2))
        if 1 <= d_val <= 31:
            return True, f'{d_val}th of month'
        return False, f'Invalid date: day {d_val} is out of bounds.'

    # 4. Standard ISO or DMY formats
    iso_match = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', clean)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        try:
            dt = datetime(y, m, d)
            return True, dt.strftime('%Y-%m-%d')
        except ValueError as ve:
            return False, f'Invalid calendar date: {ve}'

    dmy_match = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', clean)
    if dmy_match:
        d, m, y = int(dmy_match.group(1)), int(dmy_match.group(2)), int(dmy_match.group(3))
        try:
            dt = datetime(y, m, d)
            return True, dt.strftime('%d-%m-%Y')
        except ValueError as ve:
            return False, f'Invalid calendar date: {ve}'

    # 5. Pure numbers (like '0' or '45' or '100')
    if clean.isdigit():
        d_val = int(clean)
        if 1 <= d_val <= 31:
            return True, f'{d_val}th of month'
        return False, f'Invalid day number: {d_val}.'

    # If nothing matched and there's no recognizable date pattern
    return False, f'Could not recognize "{date_str}" as a valid calendar date or commitment timeline.'

if __name__ == "__main__":
    test_inputs = [
        '31 september',
        '30 september',
        'janu 0',
        '0 januaury',
        '15 januaury',
        '32 janu',
        '30 feb',
        '28 feburary',
        'rubbish with date liek 0',
        '15 tarikh ko',
        'next monday',
        'kal shaam',
        '2026-09-31',
        '2026-09-30',
        '0',
        '45',
        'somwar ko dunga'
    ]

    for t in test_inputs:
        ok, res = validate_promised_date(t)
        print(f'{t:25} -> Valid: {str(ok):5} | {res}')
