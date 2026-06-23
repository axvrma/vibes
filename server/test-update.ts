import { userRepo } from './src/db/repository';
try {
  userRepo.updateStatus('e46d1d62-442a-4ab5-9f9f-13fea3cc0d56', 0);
  console.log('Success');
} catch (e) {
  console.error('Error:', e);
}
