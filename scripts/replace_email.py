import re
import json
import sys

# Load questions
with open('questions.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Email 1 module is at index 2
module = data['modules'][2]
task_title = module['taskTitle']  # "Read in Daily Life – Email 1 (Questions 21–22)"
passage = module['passage']
questions = module['questions']

print(f'Processing: {task_title}')
print(f'Passage length: {len(passage)}')
print(f'Number of questions: {len(questions)}')

# Read the template file (already copied to reading_question3_1.html)
with open('reading_question3_1.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace basic placeholders
content = content.replace('{{QUESTION_NUMBER}}', '21')
content = content.replace('{{QUESTION_START}}', '21')
content = content.replace('{{QUESTION_END}}', '22')
content = content.replace('{{TOTAL_QUESTIONS}}', '33')
content = content.replace('{{TIMER_SECONDS}}', '690')

# Need to find and replace email content and questions
# Look for specific placeholders in the template
# First, check if there's {{EMAIL_CONTENT}} or similar
if '{{EMAIL_CONTENT}}' in content:
    content = content.replace('{{EMAIL_CONTENT}}', passage)
    print('Replaced {{EMAIL_CONTENT}}')
elif '{{PASSAGE}}' in content:
    content = content.replace('{{PASSAGE}}', passage)
    print('Replaced {{PASSAGE}}')
else:
    # Try to find pattern
    print('Warning: Email content placeholder not found')

# Replace question placeholders
# Template might have {{QUESTION_1_TEXT}}, {{QUESTION_1_OPTIONS}}, etc.
# For simplicity, we'll assume template has structured placeholders
# But we need to examine template structure first
# For now, just save and we'll manually edit if needed

with open('reading_question3_1.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Basic placeholders replaced. Manual check needed for question structure.')