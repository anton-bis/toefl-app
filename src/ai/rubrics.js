// Reserved summaries for future AI-assisted scoring. Validate them against the
// scoring guide used by the product before enabling a scoring task.
export const SCORING_RUBRICS = {
  'listen-repeat': {
    section: 'speaking',
    criteria: ['accuracy', 'completeness', 'intelligibility'],
    guide: `Listen and Repeat — score guide summary
5: Repeats the full prompt accurately and is completely understandable.
4: Preserves the prompt's meaning with only small wording or grammar changes; speech remains clear.
3: Reproduces most of the sentence, but omissions or substitutions affect accuracy; some speech may require effort.
2: Omits or changes a substantial part of the prompt; the result is fragmentary and difficult to understand.
1: Produces only a few recognizable words or an attempt that is mostly unintelligible.
0: Gives no response, no English response, an unrelated response, or speech that cannot be understood.`
  },
  interview: {
    section: 'speaking',
    criteria: ['relevance', 'development', 'fluency', 'intelligibility', 'grammar', 'vocabulary'],
    guide: `Take an Interview — score guide summary
5: Fully answers and develops the response with fluent, natural, readily intelligible speech and precise language.
4: Answers and develops the response clearly; minor pauses or language limitations do not impede meaning.
3: Addresses the question with limited development or clarity; delivery may be choppy and language control uneven.
2: Makes a relevant attempt but provides little support; limited language and intelligibility often obscure meaning.
1: Barely addresses the question through vague, isolated, or mostly unintelligible language.
0: Gives no response, no English response, an unrelated response, or speech that cannot be understood.`
  },
  'write-email': {
    section: 'writing',
    criteria: [
      'communicative purpose',
      'development',
      'organization',
      'tone',
      'grammar',
      'vocabulary'
    ],
    guide: `Write an Email — score guide summary
5: Clearly fulfills the purpose with strong development, precise language, suitable tone, and almost no errors.
4: Fulfills the purpose effectively with adequate development, appropriate language and conventions, and few errors.
3: Generally completes the task, though development, clarity, tone, or language control is inconsistent.
2: Attempts the task, but limited or irrelevant development and frequent language problems make the message ineffective.
1: Makes only a minimal, fragmented attempt with little original content and serious, frequent language problems.
0: Is blank, off topic, not in English, copied from the prompt, or otherwise unrelated to the task.`
  },
  'academic-discussion': {
    section: 'writing',
    criteria: [
      'relevance',
      'development',
      'clarity',
      'syntactic range',
      'vocabulary',
      'language accuracy'
    ],
    guide: `Write for an Academic Discussion — score guide summary
5: Makes a highly relevant, well-developed, and clear contribution with precise language and almost no errors.
4: Makes a relevant, adequately developed contribution that is easy to understand and contains few language errors.
3: Makes a mostly relevant contribution, but some support is unclear or missing and errors are noticeable.
2: Attempts to contribute, but weak or partly irrelevant ideas and accumulated errors hinder understanding.
1: Offers few coherent ideas, very limited original language, and serious, frequent errors.
0: Is blank, off topic, not in English, copied from the prompt, or otherwise unrelated to the discussion.`
  }
};
