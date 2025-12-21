// GitHub API Service para sincronización de favoritos
class GitHubService {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.token = null;
        this.username = null;
        this.repoName = 'bookmarks';
        this.filePath = 'bookmarks.json';
    }

    // Codificar string UTF-8 a base64 (soporta emojis y caracteres especiales)
    utf8ToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
        return btoa(binString);
    }

    // Decodificar base64 a string UTF-8 (soporta emojis y caracteres especiales)
    base64ToUtf8(base64) {
        const binString = atob(base64);
        const bytes = Uint8Array.from(binString, (char) => char.codePointAt(0));
        return new TextDecoder().decode(bytes);
    }

    // Configurar token de GitHub
    async setToken(token) {
        this.token = token;
        try {
            // Verificar que el token es válido
            const response = await this.makeRequest('GET', '/user');
            this.username = response.login;
            return { success: true, user: response };
        } catch (error) {
            console.error('Error verificando token:', error);
            return { success: false, error: error.message };
        }
    }

    // Realizar peticiones a la API de GitHub
    async makeRequest(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Bookmarks-App-Extension'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error en petición ${method} ${endpoint}:`, error);
            throw error;
        }
    }

    // Crear repositorio si no existe
    async ensureRepository() {
        try {
            // Verificar si el repositorio existe
            const response = await this.makeRequest('GET', `/repos/${this.username}/${this.repoName}`);
            return { success: true, exists: true, repo: response };
        } catch (error) {
            if (error.message.includes('404')) {
                // Repositorio no existe, crearlo
                return await this.createRepository();
            }
            throw error;
        }
    }

    // Crear nuevo repositorio
    async createRepository() {
        try {
            const repoData = {
                name: this.repoName,
                description: 'Mis favoritos sincronizados con Bookmarks App',
                private: true,
                auto_init: true,
                gitignore_template: 'Node'
            };

            const response = await this.makeRequest('POST', '/user/repos', repoData);
            return { success: true, exists: false, repo: response };
        } catch (error) {
            console.error('Error creando repositorio:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener contenido del archivo de favoritos
    async getBookmarksFile() {
        try {
            const response = await this.makeRequest('GET', `/repos/${this.username}/${this.repoName}/contents/${this.filePath}`);
            
            if (response.content) {
                // Decodificar contenido base64 (con soporte para UTF-8/emojis)
                const content = this.base64ToUtf8(response.content.replace(/\n/g, ''));
                return {
                    success: true,
                    data: JSON.parse(content),
                    sha: response.sha
                };
            } else {
                return {
                    success: true,
                    data: [],
                    sha: null
                };
            }
        } catch (error) {
            if (error.message.includes('404')) {
                // Archivo no existe, devolver array vacío
                return {
                    success: true,
                    data: [],
                    sha: null
                };
            }
            throw error;
        }
    }

    // Subir favoritos al repositorio
    async uploadBookmarks(bookmarks, sha = null) {
        try {
            // Codificar a base64 con soporte UTF-8 (emojis y caracteres especiales)
            const content = this.utf8ToBase64(JSON.stringify(bookmarks, null, 2));
            
            const data = {
                message: `Actualizar favoritos - ${new Date().toISOString()}`,
                content: content,
                branch: 'main'
            };

            // Si existe el archivo, incluir SHA para actualización
            if (sha) {
                data.sha = sha;
            }

            const response = await this.makeRequest('PUT', `/repos/${this.username}/${this.repoName}/contents/${this.filePath}`, data);
            
            return {
                success: true,
                sha: response.content.sha,
                commit: response.commit
            };
        } catch (error) {
            console.error('Error subiendo favoritos:', error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar favoritos (descargar desde GitHub)
    async syncFromGitHub() {
        try {
            // Asegurar que el repositorio existe
            const repoResult = await this.ensureRepository();
            if (!repoResult.success) {
                return { success: false, error: 'No se pudo acceder al repositorio' };
            }

            // Obtener favoritos del archivo
            const fileResult = await this.getBookmarksFile();
            if (!fileResult.success) {
                return { success: false, error: 'No se pudieron obtener los favoritos' };
            }

            return {
                success: true,
                bookmarks: fileResult.data,
                lastSync: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error sincronizando desde GitHub:', error);
            return { success: false, error: error.message };
        }
    }

    // Sincronizar favoritos (subir a GitHub)
    async syncToGitHub(bookmarks) {
        try {
            // Asegurar que el repositorio existe
            const repoResult = await this.ensureRepository();
            if (!repoResult.success) {
                return { success: false, error: 'No se pudo acceder al repositorio' };
            }

            // Obtener SHA del archivo actual (si existe)
            const fileResult = await this.getBookmarksFile();
            const sha = fileResult.sha;

            // Subir favoritos
            const uploadResult = await this.uploadBookmarks(bookmarks, sha);
            if (!uploadResult.success) {
                return { success: false, error: uploadResult.error };
            }

            return {
                success: true,
                sha: uploadResult.sha,
                lastSync: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error sincronizando a GitHub:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener información del repositorio
    async getRepositoryInfo() {
        try {
            const response = await this.makeRequest('GET', `/repos/${this.username}/${this.repoName}`);
            return {
                success: true,
                repo: {
                    name: response.name,
                    fullName: response.full_name,
                    url: response.html_url,
                    private: response.private,
                    updatedAt: response.updated_at,
                    size: response.size
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Listar todos los repositorios del usuario
    async listUserRepositories() {
        try {
            const response = await this.makeRequest('GET', '/user/repos?sort=updated&per_page=100');
            return {
                success: true,
                repositories: response.map(repo => ({
                    id: repo.id,
                    name: repo.name,
                    fullName: repo.full_name,
                    url: repo.html_url,
                    private: repo.private,
                    updatedAt: repo.updated_at,
                    description: repo.description,
                    hasBookmarksFile: false // Se verificará después
                }))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Verificar si un repositorio tiene archivo de favoritos
    async checkRepositoryForBookmarks(repoName) {
        try {
            const response = await this.makeRequest('GET', `/repos/${this.username}/${repoName}/contents/${this.filePath}`);
            return {
                success: true,
                hasBookmarksFile: true,
                fileInfo: {
                    name: response.name,
                    path: response.path,
                    sha: response.sha,
                    size: response.size,
                    downloadUrl: response.download_url
                }
            };
        } catch (error) {
            if (error.message.includes('404')) {
                return {
                    success: true,
                    hasBookmarksFile: false
                };
            }
            return { success: false, error: error.message };
        }
    }

    // Cambiar repositorio activo
    async setActiveRepository(repoName) {
        this.repoName = repoName;
        // Guardar preferencia en storage
        try {
            await chrome.storage.local.set({ activeRepo: repoName });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Obtener repositorio activo guardado
    async getActiveRepository() {
        try {
            const result = await chrome.storage.local.get(['activeRepo']);
            return result.activeRepo || this.repoName;
        } catch (error) {
            return this.repoName;
        }
    }

    // Crear archivo de favoritos en repositorio existente
    async createBookmarksFileInRepository(bookmarks = []) {
        try {
            // Codificar a base64 con soporte UTF-8 (emojis y caracteres especiales)
            const content = this.utf8ToBase64(JSON.stringify(bookmarks, null, 2));
            
            const data = {
                message: `Crear archivo de favoritos - ${new Date().toISOString()}`,
                content: content,
                branch: 'main'
            };

            const response = await this.makeRequest('PUT', `/repos/${this.username}/${this.repoName}/contents/${this.filePath}`, data);
            
            return {
                success: true,
                sha: response.content.sha,
                commit: response.commit
            };
        } catch (error) {
            console.error('Error creando archivo de favoritos:', error);
            return { success: false, error: error.message };
        }
    }

    // Verificar estado del repositorio actual
    async checkRepositoryStatus() {
        try {
            // Verificar si el repositorio existe
            const repoInfo = await this.getRepositoryInfo();
            if (!repoInfo.success) {
                return {
                    success: false,
                    status: 'not_found',
                    message: 'Repositorio no encontrado'
                };
            }

            // Verificar si tiene archivo de favoritos
            const bookmarksCheck = await this.checkRepositoryForBookmarks(this.repoName);
            if (!bookmarksCheck.success) {
                return {
                    success: false,
                    status: 'error',
                    message: 'Error verificando archivo de favoritos'
                };
            }

            return {
                success: true,
                status: bookmarksCheck.hasBookmarksFile ? 'ready' : 'no_bookmarks_file',
                message: bookmarksCheck.hasBookmarksFile ? 'Repositorio listo' : 'No tiene archivo de favoritos',
                repo: repoInfo.repo,
                hasBookmarksFile: bookmarksCheck.hasBookmarksFile
            };
        } catch (error) {
            return {
                success: false,
                status: 'error',
                message: error.message
            };
        }
    }

    // Verificar si hay cambios en el repositorio
    async checkForUpdates(lastSync) {
        try {
            const response = await this.makeRequest('GET', `/repos/${this.username}/${this.repoName}/commits`);
            const latestCommit = response[0];
            
            if (latestCommit && new Date(latestCommit.commit.author.date) > new Date(lastSync)) {
                return {
                    success: true,
                    hasUpdates: true,
                    latestCommit: latestCommit
                };
            }
            
            return {
                success: true,
                hasUpdates: false
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubService;
} else {
    window.GitHubService = GitHubService;
}
