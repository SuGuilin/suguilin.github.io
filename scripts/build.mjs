import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceTemplate = await readFile(path.join(root, 'src/shell.html'), 'utf8');
const versionFiles=await Promise.all(['assets/app.js','assets/workspace.css','assets/product.css','content/workspace.json','content/lessons.json'].map(file=>readFile(path.join(root,file))));
const assetVersion=createHash('sha256').update(Buffer.concat(versionFiles)).digest('hex').slice(0,12);
const template=sourceTemplate.replaceAll('{{assetVersion}}',assetVersion);
const data = JSON.parse(await readFile(path.join(root, 'content/workspace.json'), 'utf8'));
const routes = [
  ['/', 'home', '总览', '从前沿机制到工程实践，建立持续深化的 Agent 学习与作品体系。', 'grid'],
  ['/roadmap/', 'roadmap', '深化路线', '12 个深化阶段：机制、算法、框架、评测、研究与产品交付。', 'route'],
  ['/radar/', 'radar', '技术雷达', '核实官方资料，按问题选择框架、协议与 Agent 产品。', 'radar'],
  ['/lab/', 'lab', '实践实验室', '四个可复现项目，把学习变成代码、实验与能力证据。', 'flask'],
  ['/journal/', 'journal', '学习日志', '记录假设、来源、版本、结果与下一次实验。', 'pen'],
  ['/interview/', 'interview', '面试准备', '用岗位能力对标、训练题与项目答辩深化理解。', 'briefcase'],
  ['/library/', 'library', '知识库', '精选课程、论文、工程文章、框架、评测、岗位与社区入口。', 'books'],
  ['/learn/', 'learn', '专题学习', '带着要点学习机制、算法与工程，以实验深化理解。', 'file'],
  ['/assistant/', 'assistant', '学习助手', '围绕课程、源码和实验向 AI 提问，记录与保存对话。', 'spark'],
  ['/account/', 'account', '账号与备份', '登录个人账号，管理云端同步、离线缓存、导入与导出。', 'shield'],
  ['/saved/', 'saved', '收藏夹', '把资料放回自己的问题与学习计划中。', 'bookmark'],
  ['/about/', 'about', '关于工作台', 'SuGuilin 的个人 Agent 学习工作台：持续研究，记录过程，构建产品。', 'info'],
  ['/guide/', 'guide', '学习手记', '围绕 Agent 核心问题的原创实践导读与一手资料。', 'file']
];
const navigation = [routes[0],routes.find(r=>r[1]==='learn'),...routes.slice(1,6),routes.find(r=>r[1]==='assistant')].map(([url, id, title, , icon]) => `<a href="${url}" data-nav data-route="${id}"><span data-icon="${icon}"></span>${title}${id === 'radar' ? '<span class="new-dot" title="资料已核实"></span>' : ''}</a>`).join('\n');
for (const [url, id, title, description] of routes) {
  const dir = path.join(root, url);
  await mkdir(dir, {recursive: true});
  const html = template.replaceAll('{{navigation}}', navigation).replaceAll('{{title}}', title).replaceAll('{{description}}', description).replaceAll('{{path}}', url).replaceAll('{{resourceCount}}', String(data.resources.length));
  await writeFile(path.join(dir, 'index.html'), html);
}
await writeFile(path.join(root, '404.html'), template.replaceAll('{{navigation}}', navigation).replaceAll('{{title}}', '页面未找到').replaceAll('{{description}}', '返回 SuGuilin Agent 工作台继续学习。').replaceAll('{{path}}', '/404.html').replaceAll('{{resourceCount}}', String(data.resources.length)));
const oldMap = await readFile(path.join(root, 'sitemap.txt'), 'utf8').catch(() => '');
const urls = new Set([...oldMap.trim().split(/\s+/).filter(Boolean).map(url => url.replace(/^http:/, 'https:')), ...routes.map(([url]) => 'https://suguilin.github.io' + url), 'https://suguilin.github.io/blog/']);
for (const guide of data.guides) urls.add('https://suguilin.github.io/guide/?id=' + guide.id);
await writeFile(path.join(root, 'sitemap.txt'), [...urls].sort().join('\n') + '\n');
await writeFile(path.join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...urls].sort().map(url => `<url><loc>${url.replaceAll('&', '&amp;')}</loc></url>`).join('\n') + '\n</urlset>\n');
console.log(`Built ${routes.length} workspace pages with ${data.resources.length} resources.`);
