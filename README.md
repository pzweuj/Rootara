# Rootara

**English | [中文](README_ZH.md)**

## Introduction
Rootara is an easy-to-deploy consumer-grade genetic data hosting platform that users can self-deploy on their own servers to ensure data security. Rootara supports importing personal genetic data from testing service providers such as 23andMe and WeGene. Through quick installation and configuration using Docker Compose, users can safely perform various operations including ancestry analysis, genetic trait interpretation, and ClinVar database queries in their local environment.

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

#### 1. Clone the Project
```bash
git clone https://github.com/pzweuj/rootara.git
cd rootara
```

#### 2. Start Services with Docker Compose
```bash
# Start all services (frontend + backend)
docker-compose -f docker/docker-compose.yml up -d

# Check service status
docker-compose -f docker/docker-compose.yml ps

# View service logs
docker-compose -f docker/docker-compose.yml logs -f
```

#### 3. Access the Application
- Open your browser and visit: http://localhost:3000
- Default administrator account:
  - Email: `admin@rootara.app`
  - Password: `rootara123`

#### 4. Stop Services
```bash
docker-compose -f docker/docker-compose.yml down
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
- **Haplogroup Analysis**: Paternal and maternal haplogroup analysis
- **Genetic Traits**: Understand the impact of genes on personal characteristics
- **Health Risks**: Variant interpretation based on the ClinVar database

## Contributing
We welcome contributions of any form of traits, which will be added to Rootara's default traits after verification.

## License
This project is released under the AGPLv3 license. Please see the [LICENSE](LICENSE) file for more information.

## Acknowledgments
This project uses the following open source projects:
- [pysam](https://pysam.readthedocs.io/en/latest/index.html) - High-performance genomic data processing library
- [haplogrouper](https://gitlab.com/bio_anth_decode/haploGrouper) - Haplogroup analysis tool
- [admix](https://github.com/stevenliuyi/admix) - Ancestry composition analysis algorithm
- [pandas](https://pandas.pydata.org/) - Powerful data analysis tool
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
