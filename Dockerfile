# Etapa 1: Compilar la aplicación de Angular/Ionic
FROM node:20 AS builder

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar los archivos de paquetes e instalar dependencias
# Copiar package-lock.json es importante para compilaciones reproducibles
COPY package*.json ./
RUN npm install

# Copiar el resto del código fuente de la aplicación
COPY . .

# Compilar la aplicación para producción
# Para proyectos Ionic, la salida estará en la carpeta /app/www
RUN npm run build

# Etapa 2: Servir la aplicación desde un servidor web Nginx ligero
FROM nginx:alpine

# Copiar los archivos de la compilación desde la etapa "builder"
# Nginx sirve archivos desde /usr/share/nginx/html por defecto
COPY --from=builder /app/www /usr/share/nginx/html

# Exponer el puerto 80
EXPOSE 80

# El comando por defecto de la imagen de Nginx iniciará el servidor.
# CMD ["nginx", "-g", "daemon off;"] es el comando que se ejecuta.
