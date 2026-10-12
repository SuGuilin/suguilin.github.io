import curriculum from '../content/study-curriculum.json' with {type:'json'};
export const studyGroups=curriculum.groups;
export const relatedTopics=id=>curriculum.connections[id]??[];
export function curriculumGroup(id){return studyGroups.find(g=>g.units.includes(id));}
