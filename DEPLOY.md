# Ubuntu Deployment Guide

## 环境
- Ubuntu 22.04 或 24.04
- Node.js 24
- Nginx
- PM2

## 1. 安装基础软件
```bash
sudo apt update
sudo apt install -y nginx git curl
```

## 2. 安装 Node 24
推荐用 `nvm`，不要直接用 Ubuntu 自带旧版 Node：
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24
nvm alias default 24
node -v
npm -v
```

再安装 PM2：
```bash
npm install -g pm2
```

## 3. 部署项目
```bash
cd /opt
sudo git clone <你的仓库地址> new-search
sudo chown -R $USER:$USER /opt/new-search
cd /opt/new-search
npm install
npm run build
```

先本机测试：
```bash
PORT=3000 npm start
```

另开一个终端检查：
```bash
curl http://127.0.0.1:3000/api/health
```

## 4. 用 PM2 常驻运行
```bash
cd /opt/new-search
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条 `sudo` 命令，把那条命令再执行一次。

## 5. 配置 Nginx
把仓库里的 `deploy/nginx.new-search.conf` 复制到：
```bash
sudo cp /opt/new-search/deploy/nginx.new-search.conf /etc/nginx/sites-available/new-search
```

把里面的 `your-domain.com` 改成你的域名，然后启用：
```bash
sudo ln -s /etc/nginx/sites-available/new-search /etc/nginx/sites-enabled/new-search
sudo nginx -t
sudo systemctl reload nginx
```

如果启用了 UFW：
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
```

## 6. 数据与备份
- 数据库文件：`/opt/new-search/data/news-links.db`
- 备份目录：`/opt/new-search/backups/`

手动备份：
```bash
cd /opt/new-search
npm run backup
```

定时备份：
```bash
crontab -e
```

加入这一行：
```bash
10 2 * * * . $HOME/.nvm/nvm.sh && cd /opt/new-search && npm run backup >> /opt/new-search/backup.log 2>&1
```

## 7. 更新发布
```bash
cd /opt/new-search
git pull
npm install
npm run build
pm2 restart new-search
```

也可以直接执行仓库内的一键更新脚本：
```bash
cd /opt/new-search
sh deploy/update.sh
```

可选环境变量：
- `APP_NAME`：默认 `new-search`
- `PORT`：默认 `3000`
