export function createScheduler() {
  return {
    record(wordId, q, record) {
      var ef = record && record.ef || 2.5;
      var interval = record && record.interval || 0;
      var reps = record && record.repetitions || 0;

      if (q >= 3) {
        if (reps === 0) {
          interval = 1;
        } else if (reps === 1) {
          interval = 6;
        } else {
          interval = Math.round(interval * ef);
        }
        reps++;
      } else {
        reps = 0;
        interval = 1;
      }

      ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      if (ef < 1.3) ef = 1.3;

      var nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + interval);

      return {
        ef: Math.round(ef * 100) / 100,
        interval: interval,
        repetitions: reps,
        nextReview: nextReview.toISOString().split('T')[0],
        lastQ: q
      };
    },

    getDueWords(progress) {
      var today = new Date().toISOString().split('T')[0];
      var due = [];
      for (var wordId in progress) {
        if (progress[wordId].nextReview && progress[wordId].nextReview <= today) {
          due.push(wordId);
        }
      }
      return due;
    },

    getTodayReviewCount(progress) {
      var today = new Date().toISOString().split('T')[0];
      var count = 0;
      for (var subject in progress) {
        for (var setId in progress[subject]) {
          var words = progress[subject][setId].words || {};
          for (var wordId in words) {
            var rec = words[wordId];
            if (rec.nextReview && rec.nextReview <= today && rec.lastQ < 5) {
              count++;
            }
          }
        }
      }
      return count;
    },

    labelToQ(label) {
      if (label === 'remembered') return 5;
      if (label === 'hazy') return 3;
      return 1;
    }
  };
}

var scheduler = createScheduler();
export default scheduler;
