import { useState, useEffect } from 'react';
import type { FormFieldProps } from '@/types/profile';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FormField } from './FormField';
import { ChevronDown, Edit3 } from 'lucide-react';

/**
 * Collapsible choice field for profile page - shows selected values and opens modal to edit
 */
export function CollapsibleChoiceField({ field, value, onChange, error }: FormFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Keyboard shortcuts for modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere if user is typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Handle number keys for option selection
      if (event.key >= '1' && event.key <= '9') {
        const optionIndex = parseInt(event.key) - 1;
        const option = field.options?.[optionIndex];
        if (option) {
          event.preventDefault();
          
          if (field.type === 'singleChoice') {
            onChange(option.id);
          } else if (field.type === 'multipleChoice') {
            // For multiple choice, toggle the option
            const currentValues = (value as string[]) || [];
            let newValues = [...currentValues];
            
            if (newValues.includes(option.id)) {
              newValues = newValues.filter(v => v !== option.id);
            } else {
              if (option.isNoneOption) {
                newValues = [option.id];
              } else {
                // Remove "none" options when selecting other options
                newValues = newValues.filter(v => {
                  const opt = field.options?.find(o => o.id === v);
                  return !opt?.isNoneOption;
                });
                newValues.push(option.id);
              }
            }
            onChange(newValues);
          }
        }
      }

      // Handle Escape to close modal
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }

      // Handle Enter to close modal (save)
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, field, value, onChange]);

  const getDisplayValue = () => {
    if (field.type === 'singleChoice') {
      const currentValue = value as string || '';
      
      // Check if it's a predefined option
      const option = field.options?.find(opt => opt.id === currentValue);
      if (option) {
        return option.label;
      }
      
      // If it's a custom value, show it
      if (currentValue) {
        return currentValue;
      }
      
      return 'Not selected';
    }
    
    if (field.type === 'multipleChoice') {
      const currentValues = (value as string[]) || [];
      
      if (currentValues.length === 0) {
        return 'None selected';
      }
      
      const displayValues = currentValues.map(val => {
        // Check if it's a predefined option
        const option = field.options?.find(opt => opt.id === val);
        return option ? option.label : val; // Show custom values as-is
      });
      
      if (displayValues.length === 1) {
        return displayValues[0];
      }
      
      if (displayValues.length <= 3) {
        return displayValues.join(', ');
      }
      
      return `${displayValues.slice(0, 2).join(', ')} and ${displayValues.length - 2} more`;
    }
    
    return 'Not set';
  };

  const hasValue = () => {
    if (field.type === 'singleChoice') {
      return Boolean(value as string);
    }
    if (field.type === 'multipleChoice') {
      return Boolean((value as string[])?.length);
    }
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-base font-medium">
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.questionSubtitle && (
          <p className="text-sm text-muted-foreground">
            {field.questionSubtitle}
          </p>
        )}
      </div>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-between text-left h-10 px-3 py-2 ${
              error ? 'border-destructive' : ''
            } ${hasValue() ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <span className="truncate">{getDisplayValue()}</span>
            <div className="flex items-center space-x-1 ml-2">
              <Edit3 className="h-4 w-4" />
              <ChevronDown className="h-4 w-4" />
            </div>
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{field.questionTitle}</DialogTitle>
            {field.questionMotivation && (
              <p className="text-muted-foreground">
                {field.questionMotivation}
              </p>
            )}
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <FormField
              field={field}
              value={value}
              onChange={onChange}
              error={error}
            />
            
            {/* Keyboard shortcuts hint */}
            {(field.type === 'singleChoice' || field.type === 'multipleChoice') && field.options && (
              <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
                <p>💡 Use number keys <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">1-{Math.min(field.options.length, 9)}</kbd> to {field.type === 'singleChoice' ? 'select' : 'toggle'} options</p>
                <p>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to save • <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> to cancel</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      
      {field.validation?.errorMessage && !error && (
        <p className="text-xs text-muted-foreground">
          {field.validation.errorMessage}
        </p>
      )}
    </div>
  );
}
