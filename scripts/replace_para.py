import re
import json
import sys

# Load questions
with open('questions.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

module = data['modules'][1]
questions = module['questions']

# Build fill blocks
fill_blocks = []
for q in questions:
    prefix = q['prefix']
    answer = q['answer']
    qid = q['id']
    num_boxes = len(answer)
    
    block = f'''<span class="word-fill-container">
  <span class="word-prefix">{prefix}</span>
  <div class="letter-box-container" data-answer="{answer}">
'''
    for i in range(num_boxes):
        block += '    <input type="text" class="letter-box" maxlength="1" />\n'
    block += f'''  </div>
  <span class="fill-question-number">{qid}</span>
</span>'''
    fill_blocks.append(block)

# Build paragraph
para_parts = []
para_parts.append('Fungi, a group of organisms that include mushrooms and yeast, are not plants but a separate branch of life. They')
para_parts.append(fill_blocks[0])
para_parts.append('be')
para_parts.append(fill_blocks[1])
para_parts.append('in')
para_parts.append(fill_blocks[2])
para_parts.append('every')
para_parts.append(fill_blocks[3])
para_parts.append('and')
para_parts.append(fill_blocks[4])
para_parts.append('essential')
para_parts.append(fill_blocks[5])
para_parts.append('in')
para_parts.append(fill_blocks[6])
para_parts.append('ecosystems.')
para_parts.append(fill_blocks[7])
para_parts.append('of')
para_parts.append(fill_blocks[8])
para_parts.append('are decomposers,')
para_parts.append(fill_blocks[9])
para_parts.append('that they break down organic matter and recycle nutrients back into the soil. Some fungi form symbiotic relationships with plants, helping them absorb water and nutrients. While many fungi are beneficial, others can cause diseases in plants, animals, and humans.')

new_paragraph = ' '.join(para_parts)

# Read HTML file
with open('reading_question2.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the paragraph section
# Find the pattern: from 'Paleontology is the scientific study' to 'once upon a time.'
pattern = r'(Paleontology is the scientific study.*?once upon a time\.)'

# Use re.DOTALL to match across lines
new_content = re.sub(pattern, new_paragraph, content, flags=re.DOTALL)

if new_content == content:
    print('Pattern not found or no replacement made')
    sys.exit(1)
else:
    with open('reading_question2.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Paragraph replaced successfully')