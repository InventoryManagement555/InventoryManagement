const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  get baseUrl(): string {
    return API_BASE_URL;
  }

  private getHeaders(isMultipart = false): HeadersInit {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};

    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch {
        errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      }
      
      // If unauthorized, clear token and redirect (optional, or handle in Context)
      if (response.status === 401) {
        localStorage.removeItem('token');
        // Let the app know (could reload or rely on AuthContext checks)
      }
      
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: any, isForm = false): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    
    let requestBody: any;
    let headers: HeadersInit;

    if (isForm) {
      headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      const token = localStorage.getItem('token');
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
      
      const formBody = [];
      for (const property in body) {
        const encodedKey = encodeURIComponent(property);
        const encodedValue = encodeURIComponent(body[property]);
        formBody.push(encodedKey + "=" + encodedValue);
      }
      requestBody = formBody.join("&");
    } else {
      headers = this.getHeaders();
      requestBody = body ? JSON.stringify(body) : undefined;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body: any): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }
}

export const api = new ApiClient();
export default api;
