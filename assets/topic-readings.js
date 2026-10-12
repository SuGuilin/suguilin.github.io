import data from '../content/topic-readings.json' with {type:'json'};

// Editorial readings extend existing units without changing their exercise IDs or learner state.
export const topicReadings = data.readings;
