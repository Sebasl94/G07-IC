pipeline {
    // Especifica que el pipeline puede ejecutarse en cualquier agente disponible
    agent any

    // Definición de variables de entorno para el pipeline
    environment {
        // Reemplaza 'your-docker-registry-credentials-id' con el ID de tus credenciales de Docker en Jenkins
        DOCKER_REGISTRY_CREDENTIALS_ID = 'your-docker-registry-credentials-id'
        // Reemplaza 'your-dockerhub-username' con tu nombre de usuario de Docker Hub o la URL de tu registro privado
        DOCKER_REGISTRY = 'your-dockerhub-username'
        IMAGE_NAME      = 'medicationreminder'
    }

    stages {
        // Etapa 1: Obtener el código fuente
        stage('Checkout') {
            steps {
                echo 'Obteniendo el código desde el repositorio...'
                // Reemplaza la URL con la de tu repositorio de Git
                git 'https://github.com/tu-usuario/tu-repositorio.git'
            }
        }

        // Etapa 2: Instalar dependencias del proyecto
        stage('Install Dependencies') {
            agent {
                // Ejecutar esta etapa dentro de un contenedor Docker con Node.js
                docker { image 'node:20' }
            }
            steps {
                echo 'Instalando dependencias de npm...'
                sh 'npm install'
            }
        }

        // Etapa 3: Ejecutar linter y pruebas unitarias
        stage('Lint & Test') {
            agent {
                docker { image 'node:20' }
            }
            steps {
                echo 'Ejecutando linter...'
                sh 'npm run lint'
                
                echo 'Ejecutando pruebas unitarias...'
                // Se añaden flags para que 'ng test' se ejecute una sola vez y en modo headless, ideal para CI
                sh 'npm run test -- --watch=false --browsers=ChromeHeadless'
            }
        }

        // Etapa 4: Construir la imagen de Docker
        stage('Build Docker Image') {
            steps {
                echo "Construyendo la imagen Docker: ${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}"
                // Utiliza el Dockerfile en la raíz del proyecto
                script {
                    def dockerImage = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}", ".")
                }
            }
        }
        
        // Etapa 5: Publicar la imagen de Docker en un registro
        stage('Push Docker Image') {
            steps {
                echo "Publicando la imagen en ${DOCKER_REGISTRY}..."
                // Inicia sesión en el registro y sube la imagen
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
                // --- INICIO DEL EJEMPLO DE DESPLIEGUE ---
                // Aquí irían los comandos para desplegar tu aplicación.
                // Este es un ejemplo común usando SSH para actualizar un contenedor en un servidor remoto.
                // Necesitarías configurar las credenciales SSH en Jenkins.
                /*
                sshagent(['your-ssh-credentials-id']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no user@your-production-server "
                        docker pull ${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER} && \\
                        docker stop ${IMAGE_NAME} || true && \\
                        docker rm ${IMAGE_NAME} || true && \\
                        docker run -d --name ${IMAGE_NAME} -p 80:80 --restart always ${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}
                        "
                    '''
                }
                */
                // --- FIN DEL EJEMPLO DE DESPLIEGUE ---
                sh 'echo "Script de despliegue se ejecutaría aquí."'
            }
        }
    }

    // Acciones a realizar después de que el pipeline finalice
    post {
        always {
            echo 'Pipeline finalizado. Limpiando el espacio de trabajo...'
            cleanWs() // Limpia el workspace para la próxima ejecución
        }
    }
} 