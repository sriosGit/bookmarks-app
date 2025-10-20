// GitHub Authentication Service - Personal Access Token
class GitHubAuth {
    constructor() {
        // Personal Access Token - No necesita OAuth
    }

    // Iniciar proceso de autenticación con GitHub
    async authenticate() {
        try {
            // Solicitar token personal directamente
            const token = await this.requestPersonalToken();
            if (!token) {
                throw new Error('No se pudo obtener el token de acceso');
            }

            return {
                success: true,
                token: token
            };
        } catch (error) {
            console.error('Error en autenticación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Solicitar token personal de GitHub
    async requestPersonalToken() {
        return new Promise((resolve, reject) => {
            // Crear modal para solicitar token
            const modal = this.createTokenModal();
            document.body.appendChild(modal);

            // Configurar botones
            const submitBtn = modal.querySelector('#submit-token');
            const cancelBtn = modal.querySelector('#cancel-token');
            const tokenInput = modal.querySelector('#token-input');
            const validateBtn = modal.querySelector('#validate-token');

            // Validar token antes de enviar
            validateBtn.addEventListener('click', async () => {
                const token = tokenInput.value.trim();
                if (!token) {
                    this.showTokenError('Por favor, ingresa un token');
                    return;
                }

                validateBtn.textContent = '⏳ Validando...';
                validateBtn.disabled = true;

                try {
                    const isValid = await this.validateToken(token);
                    if (isValid) {
                        this.showTokenSuccess('✅ Token válido');
                        submitBtn.disabled = false;
                        submitBtn.style.background = '#28a745';
                    } else {
                        this.showTokenError('❌ Token inválido. Verifica que tenga permisos de "repo"');
                    }
                } catch (error) {
                    this.showTokenError('❌ Error validando token: ' + error.message);
                } finally {
                    validateBtn.textContent = '🔍 Validar';
                    validateBtn.disabled = false;
                }
            });

            submitBtn.addEventListener('click', () => {
                const token = tokenInput.value.trim();
                if (token) {
                    document.body.removeChild(modal);
                    resolve(token);
                } else {
                    this.showTokenError('Por favor, ingresa un token válido');
                }
            });

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                reject(new Error('Autenticación cancelada'));
            });

            // Inicialmente deshabilitar botón de envío
            submitBtn.disabled = true;
        });
    }

    // Validar token con GitHub API
    async validateToken(token) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Bookmarks-App-Extension'
                }
            });

            if (!response.ok) {
                return false;
            }

            const user = await response.json();
            return user && user.login;
        } catch (error) {
            console.error('Error validando token:', error);
            return false;
        }
    }

    // Mostrar error en el modal
    showTokenError(message) {
        const errorDiv = document.querySelector('#token-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.color = '#dc3545';
            errorDiv.style.display = 'block';
        }
    }

    // Mostrar éxito en el modal
    showTokenSuccess(message) {
        const errorDiv = document.querySelector('#token-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.color = '#28a745';
            errorDiv.style.display = 'block';
        }
    }

    // Crear modal para solicitar token
    createTokenModal() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 600px;
                width: 90%;
            ">
                <h3 style="margin-bottom: 20px; color: #333;">🔐 Configurar GitHub</h3>
                <p style="margin-bottom: 15px; color: #666;">
                    Para sincronizar tus favoritos con GitHub, necesitas crear un token de acceso personal:
                </p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #333; font-size: 14px;">📋 Pasos:</h4>
                    <ol style="margin: 0; color: #666; font-size: 13px; line-height: 1.6;">
                        <li>Ve a <a href="https://github.com/settings/tokens" target="_blank" style="color: #667eea;">GitHub Settings > Tokens</a></li>
                        <li>Haz clic en "Generate new token (classic)"</li>
                        <li>Selecciona el scope <strong>"repo"</strong> (acceso completo a repositorios)</li>
                        <li>Copia el token generado y pégalo abajo</li>
                    </ol>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Token de GitHub:</label>
                    <input 
                        id="token-input" 
                        type="password" 
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        style="
                            width: 100%;
                            padding: 12px;
                            border: 2px solid #e1e5e9;
                            border-radius: 8px;
                            font-size: 14px;
                            font-family: monospace;
                        "
                    />
                </div>

                <div id="token-error" style="
                    display: none;
                    margin-bottom: 15px;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                "></div>

                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-token" style="
                        padding: 10px 20px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancelar</button>
                    <button id="validate-token" style="
                        padding: 10px 20px;
                        border: 1px solid #667eea;
                        background: white;
                        color: #667eea;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">🔍 Validar</button>
                    <button id="submit-token" style="
                        padding: 10px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    " disabled>Configurar</button>
                </div>
            </div>
        `;

        return modal;
    }

    // Verificar si hay un token guardado
    async getStoredToken() {
        try {
            const result = await chrome.storage.local.get(['githubToken']);
            return result.githubToken || null;
        } catch (error) {
            console.error('Error obteniendo token guardado:', error);
            return null;
        }
    }

    // Guardar token
    async saveToken(token) {
        try {
            await chrome.storage.local.set({ githubToken: token });
            return true;
        } catch (error) {
            console.error('Error guardando token:', error);
            return false;
        }
    }

    // Eliminar token
    async clearToken() {
        try {
            await chrome.storage.local.remove(['githubToken']);
            return true;
        } catch (error) {
            console.error('Error eliminando token:', error);
            return false;
        }
    }

    // Verificar si el usuario está autenticado
    async isAuthenticated() {
        const token = await this.getStoredToken();
        return token !== null;
    }

    // Cerrar sesión
    async logout() {
        await this.clearToken();
        return { success: true };
    }
}

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubAuth;
} else {
    window.GitHubAuth = GitHubAuth;
}