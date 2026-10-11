# SuGuilin 博客

这个仓库保存 Hexo / Butterfly 生成后的静态站点，可以直接通过静态 HTTP 服务运行，不需要安装 npm 依赖。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8000/>。按 `Ctrl+C` 停止服务。页面使用从站点根目录开始的资源路径，请通过 HTTP 服务访问，并在部署时使用域名根目录。

## 页面维护

- 友链的正式路径是 `/link/`，旧路径 `/links/` 会跳转到正式页面。
- `/share/`、`/photos/`、`/music/`、`/movies/`、`/comment/`、`/about/` 是独立的静态页面，直接编辑各目录中的 `index.html` 即可。
- 音乐和影视目前显示空状态，添加真实条目后可替换正文；留言板使用邮件和 QQ 联系方式，没有在线留言存储服务。
- 气泡效果使用本地 `/js/chocolate.js`；部分图标、主题扩展和外部图片仍依赖网络。

仓库不包含 Hexo 的 `source/`、主题源码、`_config.yml` 或 `package.json`，因此不能在这里运行 `hexo generate`。以后若从原 Hexo 项目重新生成站点，应先将页面、导航和气泡脚本的修改同步回源项目，避免发布时覆盖。
