import { useState, useEffect } from 'react';
import type { FormFieldProps } from '@/types/profile';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Dynamic form field component that renders different input types
 * based on the field configuration
 */
export function FormField({ field, value, onChange, error }: FormFieldProps) {
  const [customValue, setCustomValue] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  // Use field ID to make custom values specific to each field
  const [customValuesByField, setCustomValuesByField] = useState<Record<string, string[]>>({});
  
  // Get custom values for this specific field
  const customValues = customValuesByField[field.id] || [];
  const setCustomValues = (values: string[]) => {
    setCustomValuesByField(prev => ({
      ...prev,
      [field.id]: values
    }));
  };

  // Initialize custom input state when field loads
  useEffect(() => {
    const currentValue = value as string || '';
    const isCustomValue = field.type === 'singleChoice' && 
      currentValue && !field.options?.some(option => option.id === currentValue);
    
    if (isCustomValue) {
      setShowCustomInput(true);
      setCustomValue(currentValue);
    } else {
      // Reset when switching to a new field
      setCustomValue('');
      setShowCustomInput(false);
    }
  }, [field.id]); // Only depend on field.id to avoid interfering with user input

  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={value as string || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter your ${field.label.toLowerCase()}...`}
            className={error ? 'border-destructive' : ''}
          />
        );

      case 'number':
        return (
          <div className="space-y-2">
            <Input
              type="number"
              value={value as number || ''}
              onChange={(e) => onChange(Number(e.target.value))}
              placeholder={`Enter ${field.label.toLowerCase()}...`}
              min={field.validation?.min}
              max={field.validation?.max}
              className={error ? 'border-destructive' : ''}
            />
            {field.unit && (
              <p className="text-sm text-muted-foreground">Unit: {field.unit}</p>
            )}
          </div>
        );

      case 'stepper':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {field.validation?.min || 0}
              </span>
              <span className="text-lg font-semibold">
                {value || field.validation?.min || 0}
                {field.unit && ` ${field.unit}`}
              </span>
              <span className="text-sm text-muted-foreground">
                {field.validation?.max || 10}
              </span>
            </div>
            <Slider
              value={[value as number || field.validation?.min || 0]}
              onValueChange={(values) => onChange(values[0])}
              min={field.validation?.min || 0}
              max={field.validation?.max || 10}
              step={1}
              className="w-full"
            />
          </div>
        );

      case 'singleChoice':
        // Check if current value is a custom value (not in predefined options)
        const currentValue = value as string || '';
        const isCustomValue = currentValue && !field.options?.some(option => option.id === currentValue);
        // If showCustomInput is true, we should show 'custom' as selected even if value is empty
        const radioGroupValue = (isCustomValue || showCustomInput) ? 'custom' : currentValue;
        
        return (
          <div className="space-y-4">
            <RadioGroup
              value={radioGroupValue}
              onValueChange={(selectedValue) => {
                if (selectedValue === 'custom') {
                  setShowCustomInput(true);
                  // If there's already a custom value, keep it
                  if (!isCustomValue) {
                    setCustomValue('');
                  }
                } else {
                  setShowCustomInput(false);
                  setCustomValue('');
                  onChange(selectedValue);
                }
              }}
              className="space-y-3"
            >
              {field.options?.map((option, index) => (
                <Label 
                  key={option.id} 
                  htmlFor={option.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value={option.id} 
                      id={option.id}
                    />
                    {index < 9 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded opacity-60 group-hover:opacity-100">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1.5 leading-none flex-1">
                    <span className="text-sm font-medium leading-none">
                      {option.label}
                    </span>
                    {option.subLabel && (
                      <p className="text-xs text-muted-foreground">
                        {option.subLabel}
                      </p>
                    )}
                  </div>
                </Label>
              ))}
              
              {field.allowsCustomInput && (
                <div className="space-y-2">
                  <Label 
                    htmlFor="custom"
                    className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    <RadioGroupItem 
                      value="custom" 
                      id="custom"
                    />
                    <span className="text-sm font-medium leading-none flex-1">
                      Other
                    </span>
                  </Label>
                  {(showCustomInput || isCustomValue) && (
                    <Input
                      type="text"
                      value={isCustomValue ? currentValue : customValue}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setCustomValue(newValue);
                        onChange(newValue);
                      }}
                      placeholder={`Specify your ${field.label.toLowerCase()}...`}
                      className="ml-0"
                    />
                  )}
                </div>
              )}
            </RadioGroup>
          </div>
        );

      case 'multipleChoice':
        const currentValues = (value as string[]) || [];
        
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              {field.options?.map((option, index) => (
                <Label 
                  key={option.id} 
                  htmlFor={option.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={option.id}
                      checked={currentValues.includes(option.id)}
                      onCheckedChange={(checked) => {
                        let newValues = [...currentValues];
                        if (checked) {
                          // If this is a "none" option, clear all other selections
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
                        } else {
                          newValues = newValues.filter(v => v !== option.id);
                        }
                        onChange(newValues);
                      }}
                    />
                    {index < 9 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded opacity-60 group-hover:opacity-100">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1.5 leading-none flex-1">
                    <span className="text-sm font-medium leading-none">
                      {option.label}
                    </span>
                    {option.subLabel && (
                      <p className="text-xs text-muted-foreground">
                        {option.subLabel}
                      </p>
                    )}
                  </div>
                </Label>
              ))}
            </div>
            
            {field.allowsCustomInput && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom options:</Label>
                {customValues.map((customVal, index) => {
                  const checkboxId = `custom-${field.id}-${index}`;
                  return (
                    <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors group">
                      <Label
                        htmlFor={checkboxId}
                        className="flex items-center space-x-3 flex-1 cursor-pointer"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={currentValues.includes(customVal)}
                          onCheckedChange={(checked) => {
                            let newValues = [...currentValues];
                            if (checked) {
                              // Remove "none" options when selecting custom options
                              newValues = newValues.filter(v => {
                                const opt = field.options?.find(o => o.id === v);
                                return !opt?.isNoneOption;
                              });
                              newValues.push(customVal);
                            } else {
                              newValues = newValues.filter(v => v !== customVal);
                            }
                            onChange(newValues);
                          }}
                        />
                        <span className="text-sm font-medium">{customVal}</span>
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent label click
                          const newCustomValues = customValues.filter((_, i) => i !== index);
                          setCustomValues(newCustomValues);
                          // Remove from selected values too
                          const newValues = currentValues.filter(v => v !== customVal);
                          onChange(newValues);
                        }}
                        className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100"
                      >
                        ×
                      </Button>
                    </div>
                  );
                })}
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder={`Add custom ${field.label.toLowerCase().replace(/s$/, '')}...`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (customValue.trim()) {
                        setCustomValues([...customValues, customValue.trim()]);
                        setCustomValue('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="p-4 text-center text-muted-foreground">
            Unsupported field type: {field.type}
          </div>
        );
    }
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
      
      {renderField()}
      
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
