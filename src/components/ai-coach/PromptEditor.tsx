/**
 * Prompt Editor - Component for editing AI Coach prompts
 * Allows users to customize prompts used for AI generation
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ChevronDown, Info, RotateCcw } from 'lucide-react';
import type { CustomPromptConfig } from '@/types/profile';

interface PromptEditorProps {
  title: string;
  description: string;
  initialPrompt: CustomPromptConfig;
  availablePlaceholders: Array<{
    placeholder: string;
    description: string;
    example?: string;
  }>;
  populatedData?: Record<string, string>; // Actual data to show in preview
  onSave: (prompt: CustomPromptConfig) => Promise<void>;
  onReset: () => Promise<void>;
  loading?: boolean;
}

/**
 * Prompt editor component
 */
export function PromptEditor({
  title,
  description,
  initialPrompt,
  availablePlaceholders,
  populatedData,
  onSave,
  onReset,
  loading = false
}: PromptEditorProps) {
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt.systemPrompt);
  const [userPromptTemplate, setUserPromptTemplate] = useState(initialPrompt.userPromptTemplate);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when initialPrompt changes
  useEffect(() => {
    setSystemPrompt(initialPrompt.systemPrompt);
    setUserPromptTemplate(initialPrompt.userPromptTemplate);
    setHasChanges(false);
  }, [initialPrompt]);

  // Track changes
  useEffect(() => {
    const changed = 
      systemPrompt !== initialPrompt.systemPrompt ||
      userPromptTemplate !== initialPrompt.userPromptTemplate;
    setHasChanges(changed);
  }, [systemPrompt, userPromptTemplate, initialPrompt]);

  const handleSave = async () => {
    await onSave({
      systemPrompt,
      userPromptTemplate
    });
  };

  const handleReset = async () => {
    if (confirm('Reset this prompt to default? Your custom changes will be lost.')) {
      await onReset();
    }
  };

  // Generate preview by replacing placeholders with actual data
  const generatePreview = () => {
    if (!populatedData) return { system: systemPrompt, user: userPromptTemplate };

    let populatedUserPrompt = userPromptTemplate;
    Object.entries(populatedData).forEach(([placeholder, value]) => {
      populatedUserPrompt = populatedUserPrompt.replace(
        new RegExp(`\\{${placeholder}\\}`, 'g'),
        value
      );
    });

    return {
      system: systemPrompt,
      user: populatedUserPrompt
    };
  };

  const preview = generatePreview();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Prompt */}
        <div className="space-y-2">
          <Label htmlFor="system-prompt">System Prompt</Label>
          <Textarea
            id="system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            placeholder="Enter system prompt..."
          />
          <p className="text-xs text-muted-foreground">
            This defines the AI's role and behavior during generation.
          </p>
        </div>

        {/* User Prompt Template */}
        <div className="space-y-2">
          <Label htmlFor="user-prompt">User Prompt Template</Label>
          <Textarea
            id="user-prompt"
            value={userPromptTemplate}
            onChange={(e) => setUserPromptTemplate(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="Enter user prompt template with placeholders..."
          />
          <p className="text-xs text-muted-foreground">
            This is the main prompt sent to the AI. Use placeholders from the list below.
          </p>
        </div>

        {/* Placeholders Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-sm">Available Placeholders:</p>
              <div className="grid gap-2 text-xs">
                {availablePlaceholders.map((item) => (
                  <div key={item.placeholder} className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                        {`{${item.placeholder}}`}
                      </code>
                      <span className="text-muted-foreground">{item.description}</span>
                    </div>
                    {item.example && (
                      <div className="pl-4 text-muted-foreground">
                        Example: {item.example}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Preview Section */}
        {populatedData && (
          <Collapsible open={showPreview} onOpenChange={setShowPreview}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
                {showPreview ? 'Hide' : 'Show'} Populated Prompt Preview
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>System Prompt (Final)</Label>
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {preview.system}
                  </pre>
                </div>
              </div>
              <div className="space-y-2">
                <Label>User Prompt (Populated)</Label>
                <div className="bg-muted p-3 rounded-md max-h-96 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {preview.user}
                  </pre>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={loading || !hasChanges}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Custom Prompt
          </Button>
        </div>

        {hasChanges && !loading && (
          <p className="text-xs text-muted-foreground text-center">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}


