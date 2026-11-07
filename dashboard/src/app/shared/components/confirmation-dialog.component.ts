import { Component, inject, Injectable } from '@angular/core';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { FormsModule } from '@angular/forms';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogService } from '../../components/ui/dialog/src/lib/hlm-dialog.service';
import { firstValueFrom } from 'rxjs';
@Component({
  standalone: true,
  imports: [HlmButtonImports,FormsModule,HlmInputImports],
  template: `<div class="p-6 space-y-6">
    <h2 class="text-xl font-semibold">{{ data.title }}</h2>
    <p class="text-muted-foreground whitespace-pre-line">{{ data.message }}</p>
    @if(data.password){<label class="block">New password<input hlmInput type="password" autocomplete="new-password" class="mt-2 w-full" [(ngModel)]="password" minlength="12" maxlength="1024"><span class="text-sm text-muted-foreground">At least 12 characters.</span></label>}
    <div class="flex justify-end gap-3">
      <button hlmBtn variant="outline" (click)="ref.close(false)">
        {{ data.confirm ? 'Cancel' : 'Close' }}
      </button>
      @if (data.confirm) {
        <button hlmBtn variant="destructive" [disabled]="data.password && password.length<12" (click)="ref.close(data.password?password:true)">
          {{data.password?'Save password':'Confirm'}}
        </button>
      }
    </div>
  </div>`,
})
export class ConfirmationDialogComponent {
  password='';
  ref = inject(BrnDialogRef);
  data = injectBrnDialogContext<{
    title: string;
    message: string;
    confirm: boolean;
    password?:boolean;
  }>();
}
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private dialogs = inject(HlmDialogService);
  confirm(message: string) {
    return firstValueFrom(
      this.dialogs.open(ConfirmationDialogComponent, {
        context: { title: 'Confirm action', message, confirm: true },
        contentClass: 'sm:max-w-md',
      }).closed$,
    );
  }
  async password(message:string):Promise<string|null>{
    const result=await firstValueFrom(this.dialogs.open(ConfirmationDialogComponent,{context:{title:'Update password',message,confirm:true,password:true},contentClass:'sm:max-w-md'}).closed$);
    return typeof result==='string'?result:null;
  }
  alert(message: string) {
    this.dialogs.open(ConfirmationDialogComponent, {
      context: { title: 'Vibes', message, confirm: false },
      contentClass: 'sm:max-w-md',
    });
  }
}
