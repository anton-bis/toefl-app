import re
import json
import sys

# Load questions
with open('questions.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

module = data['modules'][2]  # Email 1
passage = module['passage']
questions = module['questions']

# First question (Q21)
q = questions[0]
q_text = q['text']
options = q['options']
correct_answer = q['correctAnswer']

# Parse passage
lines = passage.split('\n')
email_date = ''
email_subject = ''
email_sender = ''
email_body = ''

for line in lines:
    if line.startswith('Date:'):
        email_date = line.replace('Date:', '').strip()
    elif line.startswith('Subject:'):
        email_subject = line.replace('Subject:', '').strip()
    elif line.startswith('Best regards,'):
        # Sender is after Best regards,
        pass
    # Could extract sender, but assume it's at the end
# Simple extraction: sender is last line
email_sender = lines[-1].strip()
# Body is everything between Dear... and Best regards,
body_start = passage.find('Dear')
body_end = passage.find('Best regards,')
if body_start != -1 and body_end != -1:
    email_body = passage[body_start:body_end].strip()
else:
    email_body = passage

# Read the HTML file
with open('reading_question3_1.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace email placeholders
content = content.replace('{{EMAIL_DATE}}', email_date)
content = content.replace('{{EMAIL_SUBJECT}}', email_subject)
content = content.replace('{{EMAIL_SENDER}}', email_sender)
content = content.replace('{{EMAIL_BODY}}', email_body)

# Replace question placeholders
content = content.replace('{{QUESTION_TEXT}}', q_text)

# Options
option_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
for letter, idx in option_map.items():
    opt_text = options[idx]['text']
    content = content.replace(f'{{{{OPTION_{letter}}}}}', opt_text)
    # Correct marker
    if correct_answer == letter:
        content = content.replace(f'{{{{CORRECT_{letter}}}}}', 'correct-option')
    else:
        content = content.replace(f'{{{{CORRECT_{letter}}}}}', '')

# Other placeholders
content = content.replace('{{QUESTION_NUMBER}}', '21')
content = content.replace('{{QUESTION_COUNT}}', '1')  # only one question on this page
content = content.replace('{{TIMER_SECONDS}}', '690')
content = content.replace('{{BACK_PAGE}}', 'reading_question2.html')
content = content.replace('{{NEXT_PAGE}}', 'reading_question3_2.html')

# Write back
with open('reading_question3_1.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Email Q21 placeholders replaced.')