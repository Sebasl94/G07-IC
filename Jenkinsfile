pipeline {
    // Especifica que el pipeline puede ejecutarse en cualquier agente disponible.
    // Para esta configuración, el agente debe tener Node.js, Chrome y Docker preinstalados.
    agent any

    // Definición de variables de entorno para el pipeline
    environment {
        // Reemplaza 'your-docker-registry-credentials-id' con el ID de tus credenciales de Docker en Jenkins
        DOCKER_REGISTRY_CREDENTIALS_ID = 'b81442a4-d867-4d37-a609-20de5d8f33eb'
        // Reemplaza 'your-dockerhub-username' con tu nombre de usuario de Docker Hub o la URL de tu registro privado
        DOCKER_REGISTRY = 'jesm1708'
        IMAGE_NAME      = 'medicationreminder'
    }

    stages {
        // Etapa 1: Obtener el código fuente
        stage('Checkout') {
            steps {
                echo 'Obteniendo el código desde el repositorio configurado en el job...'
                // 'checkout scm' clona el repositorio especificado en la configuración del pipeline en Jenkins.
                checkout scm
            }
        }

        // Etapa 2: Instalar dependencias del proyecto
        stage('Install Dependencies') {
            steps {
                echo 'Instalando dependencias de npm...'
                sh 'npm install'
            }
        }

        // Etapa 3: Ejecutar linter y pruebas unitarias
        stage('Lint & Test') {
            steps {
                echo 'Ejecutando linter...'
                sh 'npm run lint'
                
                echo 'Ejecutando pruebas unitarias...'
                // Se añaden flags para que 'ng test' se ejecute una sola vez y en modo headless.
                // El flag --no-sandbox a menudo es necesario para ejecutar Chrome dentro de contenedores.
                sh 'npm run test -- --watch=false --browsers=ChromeHeadless --no-sandbox'
            }
        }

        // Etapa 4: Construir la imagen de Docker
        stage('Build Docker Image') {
            steps {
                echo "Construyendo la imagen Docker: ${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}"
                // Utiliza el Dockerfile en la raíz del proyecto para construir la imagen de la aplicación.
                script {
                    def dockerImage = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}", "Dockerfile")
                }
            }
        }
        
        // Etapa 5: Publicar la imagen de Docker en un registro
        stage('Push Docker Image') {
            steps {
                echo "Publicando la imagen en ${DOCKER_REGISTRY}..."
                // Inicia sesión en el registro y sube la imagen.
                script {
                    docker.withRegistry("https://index.docker.io/v1/", DOCKER_REGISTRY_CREDENTIALS_ID) {
                        docker.image("${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}").push()
                    }
                }
            }
        }

        // Etapa 6: Desplegar la aplicación (ejemplo)
        stage('Deploy') {
            steps {
                echo 'Desplegando la aplicación en producción...'
                sh 'echo "Script de despliegue se ejecutaría aquí."'
            }
        }
    }

    // Acciones a realizar después de que el pipeline finalice
    post {
        always {
            echo 'Pipeline finalizado. Limpiando el espacio de trabajo...'
            cleanWs() // Limpia el workspace para la próxima ejecución.
        }
    }
}