# Rootara

**English | [中文](README_ZH.md)**

## Introduction
Rootara is an easy-to-deploy consumer-grade genetic data hosting platform that users can self-deploy on their own servers to ensure data security. Rootara supports importing personal genetic data from testing service providers such as 23andMe and WeGene. Through quick installation and configuration using Docker Compose, users can safely perform various operations including ancestry analysis, genetic trait interpretation, and ClinVar database queries in their local environment.

## ⚠️ NOTICE

**The current system is in a testing phase, and all genetic trait analysis results are randomly generated test data with no scientific basis or reference value. Please do not use the test results for any medical, health-related, or other important decision-making purposes.**

## Features
- **Multi-source Compatibility**: Supports uploading genetic data files in various formats
- **Comprehensive Analysis**:
  - Ancestral origin exploration
  - Genetic trait assessment
  - Customizable trait content
  - ClinVar variant interpretation
- **Privacy Protection**: All processing is completed locally, ensuring your personal information is not leaked

## Quick Start
### System Requirements
- **Memory**: ≥ 2GB RAM (may use approximately 1GB RAM during report analysis)
- **Storage**: ≥ 5GB available space

### Installation Steps

Start Services with Docker Compose.

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/pzweuj/rootara-backend:latest
    container_name: rootara-backend
    command: /bin/bash /app/init.sh
    volumes:
      - ./data:/data
    restart: unless-stopped

  frontend:
    image: ghcr.io/pzweuj/rootara:latest
    container_name: rootara-frontend
    ports:
      - "3000:3000"
    environment:
      - TZ=Asia/Shanghai                                         # Timezone setting
      - ADMIN_EMAIL=admin@rootara.app                            # Admin user email
      - ADMIN_PASSWORD=rootara123                                # Admin user password
      - JWT_SECRET=rootara_jwt_secret                            # Secret key for JWT
      - ROOTARA_BACKEND_API_KEY=rootara_api_key_default_001      # API key for backend authentication
      - ROOTARA_BACKEND_URL=http://backend:8000                  # Backend service URL
      - NODE_ENV=production                                      # Production environment mode
      - NEXT_TELEMETRY_DISABLED=1                                # Disable Next.js telemetry
    restart: unless-stopped

networks:
  default:
    name: rootara
```

### Environment Variable Configuration (Optional)
It is recommended to modify the environment variables in the `docker/docker-compose.yml` file:

```yaml
environment:
  - ADMIN_EMAIL=admin@rootara.app                            # Administrator email
  - ADMIN_PASSWORD=rootara123                                # Administrator password
  - JWT_SECRET=rootara_jwt_secret                            # JWT secret key
  - ROOTARA_BACKEND_API_KEY=rootara_api_key_default_001      # Backend API key
```

## User Guide

### Data Upload
1. After logging into the system, click "Upload Data"
2. Supported file formats:
   - 23andMe raw data files (.txt)
   - WeGene raw data files (.txt)

### Analysis Features
- **Ancestry Analysis**: View your ancestral geographical distribution

![ancestry](public/Rootara_Ancestry.png)

- **Haplogroup Analysis**: Paternal and maternal haplogroup analysis
- **Genetic Traits**: Understand the impact of genes on personal characteristics
- **Health Risks**: Variant interpretation based on the ClinVar database

![clinvar](public/Rootara_Clinvar.png)

## Contributing
We welcome contributions of any form of traits, which will be added to Rootara's default traits after verification.

## License
This project is released under the AGPLv3 license. Please see the [LICENSE](LICENSE) file for more information.

