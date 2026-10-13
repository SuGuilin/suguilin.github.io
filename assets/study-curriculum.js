import curriculum from '../content/study-curriculum.json' with {type:'json'};
export const studyGroups=curriculum.groups;
export const relatedTopics=id=>curriculum.connections[id]??[];
// Explicit prerequisites differ from undirected related reading; never infer mastery.
export const prerequisiteTopics=id=>curriculum.prerequisites?.[id]??[];
export function topicInterviewQuestions(id,questions=[]){return questions.filter(q=>q.studyUnits?.includes(id));}
export function curriculumGroup(id){return studyGroups.find(g=>g.units.includes(id));}
