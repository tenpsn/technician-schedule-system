import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

// หน้าที่ admin ใช้ได้คนเดียว คนอื่นถูกส่งกลับไปหน้าปฏิทิน
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated && auth.isAdmin) {
    return true;
  }

  router.navigate([auth.isAuthenticated ? '/calendar' : '/login']);
  return false;
};
