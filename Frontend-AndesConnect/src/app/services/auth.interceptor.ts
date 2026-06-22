import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo adjuntar token si la petición va a nuestra API de FastAPI
  if (req.url.startsWith(environment.apiUrl)) {
    const token = localStorage.getItem('rt_token');
    if (token) {
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next(cloned);
    }
  }
  return next(req);
};
