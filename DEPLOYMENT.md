# Content Reworker - Production Deployment Guide

This guide will help you deploy the Content Reworker application to your production server.

## Prerequisites

- **Server**: Ubuntu 20.04+ or similar Linux distribution
- **Node.js**: Version 18 or higher
- **PostgreSQL**: Version 12 or higher
- **Memory**: At least 2GB RAM
- **Storage**: At least 10GB available space
- **Domain**: A domain name pointing to your server (for SSL)

## Quick Deployment Options

### Option 1: Docker Deployment (Recommended)

1. **Install Docker and Docker Compose** on your server
2. **Clone your repository** to the server
3. **Set up environment variables**:
   ```bash
   cp .env.production .env
   # Edit .env with your actual values
   ```
4. **Deploy with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

### Option 2: Traditional Server Deployment

#### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install nginx -y
```

#### Step 2: Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE contentreworker_prod;
CREATE USER contentreworker WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE contentreworker_prod TO contentreworker;
\q
```

#### Step 3: Application Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/content-reworker
sudo chown $USER:$USER /var/www/content-reworker

# Clone repository
cd /var/www/content-reworker
git clone your-repo-url .

# Install dependencies
npm ci --only=production

# Set up environment variables
cp .env.production .env
# Edit .env with your actual values
nano .env
```

#### Step 4: Build and Run

```bash
# Build the application
npm run build

# Run database migrations
./migrate-db.sh

# Start with PM2
pm2 start ecosystem.config.json
pm2 save
pm2 startup
```

#### Step 5: Nginx Configuration

```bash
# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/content-reworker
sudo ln -s /etc/nginx/sites-available/content-reworker /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

#### Step 6: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Environment Variables

Update `.env.production` with your actual values:

```bash
# Database
DATABASE_URL=postgresql://contentreworker:your_password@localhost:5432/contentreworker_prod

# API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Session Security
SESSION_SECRET=your_very_secure_random_string_here

# LinkedIn Integration (optional)
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=https://yourdomain.com/auth/linkedin/callback

# Application
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
```

## Security Checklist

- [ ] Use strong passwords for database
- [ ] Generate secure SESSION_SECRET
- [ ] Keep API keys secure and never commit them
- [ ] Set up firewall (UFW)
- [ ] Enable SSL/TLS certificates
- [ ] Regular security updates
- [ ] Monitor application logs

## Monitoring and Maintenance

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs content-reworker

# Restart application
pm2 restart content-reworker

# Stop application
pm2 stop content-reworker
```

### Database Backup
```bash
# Create backup
pg_dump -U contentreworker -h localhost contentreworker_prod > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U contentreworker -h localhost contentreworker_prod < backup_file.sql
```

### Log Locations
- Application logs: `/var/www/content-reworker/logs/`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

## Troubleshooting

### Common Issues

1. **Port 5000 not accessible**
   - Check firewall: `sudo ufw allow 5000`
   - Verify application is running: `pm2 status`

2. **Database connection errors**
   - Check PostgreSQL status: `sudo systemctl status postgresql`
   - Verify DATABASE_URL in `.env`

3. **Build errors**
   - Check Node.js version: `node --version`
   - Clear cache: `npm cache clean --force`

4. **SSL certificate issues**
   - Renew certificate: `sudo certbot renew`
   - Check certificate status: `sudo certbot certificates`

### Performance Optimization

- Use PM2 cluster mode for multiple CPU cores
- Enable Nginx gzip compression
- Set up CDN for static assets
- Monitor memory usage and add swap if needed
- Set up database connection pooling

## Updates and Deployments

### Updating the Application
```bash
cd /var/www/content-reworker
git pull origin main
npm ci --only=production
npm run build
pm2 restart content-reworker
```

### Zero-Downtime Deployment
```bash
# Use PM2 graceful reload
pm2 reload content-reworker
```

## Support

For issues and questions:
- Check application logs first
- Review this documentation
- Check server resources (CPU, memory, disk)
- Verify all environment variables are set correctly

---

**Remember**: Always test deployments on a staging server first!