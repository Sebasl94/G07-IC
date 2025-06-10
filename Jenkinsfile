# Empieza con una imagen oficial de Jenkins que incluya Java (necesario para Jenkins)
FROM jenkins/jenkins:lts-jdk17

# Cambia al usuario root para poder instalar software
USER root

# --- Instalar Node.js y npm ---
# Descarga y ejecuta el script de instalación de NodeSource para Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
# Instala Node.js (que incluye npm)
RUN apt-get update && apt-get install -y nodejs

# --- Instalar Google Chrome para las pruebas de Karma ---
# Es necesario para 'ng test --browsers=ChromeHeadless'
RUN apt-get install -y wget
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN apt-get install -y ./google-chrome-stable_current_amd64.deb
# Limpia el archivo descargado para mantener la imagen pequeña
RUN rm google-chrome-stable_current_amd64.deb

# --- Instalar el cliente de Docker (para construir imágenes) ---
# Necesario para que Jenkins pueda ejecutar comandos 'docker build', 'docker push', etc.
RUN apt-get install -y lsb-release
RUN curl -fsSLo /usr/share/keyrings/docker-archive-keyring.asc \
  https://download.docker.com/linux/debian/gpg
RUN echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/usr/share/keyrings/docker-archive-keyring.asc] \
  https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
RUN apt-get update && apt-get install -y docker-ce-cli

# Vuelve al usuario por defecto de Jenkins
USER jenkins