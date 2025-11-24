import React, { useState, useEffect } from 'react';
import type { PatternsMap, FieldsConfig, FieldValidationConfig } from './types';
import {
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';

const API_BASE = 'http://localhost:5000';

// ---------------------- Helpers ----------------------

// Helper to detect simple JS type
function detectType(value: any): FieldValidationConfig['detectedType'] {
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return value === null ? 'unknown' : 'object';
    default:
      return 'unknown';
  }
}

// Try to guess ObjectType name from collection property name, e.g. "roles" -> "Role", "tasks" -> "Task"
function inferObjectTypeNameFromPath(path: string): string {
  const lastSegment = path.split('.').pop() ?? 'Item';
  let base = lastSegment;

  const bracketIndex = base.indexOf('[');
  if (bracketIndex >= 0) {
    base = base.substring(0, bracketIndex);
  }

  if (base.endsWith('s') && base.length > 1) {
    base = base.slice(0, -1);
  }

  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Analyze JSON sample into:
 * - rootFields: Validation.Types[typeName]
 * - objectTypes: Validation.ObjectTypes
 */
function analyzeJsonToConfigs(value: any) {
  const rootFields: FieldsConfig = {};
  const objectTypes: Record<string, FieldsConfig> = {};

  const builtObjectTypes = new Set<string>();

  function buildObjectTypeFromSample(obj: any, objectTypeName: string) {
    if (!objectTypes[objectTypeName]) {
      objectTypes[objectTypeName] = {};
    }
    const fields = objectTypes[objectTypeName];

    function walkObject(v: any, prefix = '') {
      const t = detectType(v);

      if (t !== 'object' && t !== 'array') {
        const fieldName = prefix || 'value';
        if (!fields[fieldName]) {
          fields[fieldName] = {
            required: true,
            patternKey: '',
            detectedType: t
          };
        }
        return;
      }

      if (Array.isArray(v)) {
        if (v.length === 0) return;
        const newPrefix = prefix ? `${prefix}[*]` : '[*]';
        walkObject(v[0], newPrefix);
        return;
      }

      for (const [k, child] of Object.entries(v)) {
        const newPrefix = prefix ? `${prefix}.${k}` : k;
        const childType = detectType(child);
        if (childType === 'object' || childType === 'array') {
          walkObject(child, newPrefix);
        } else {
          if (!fields[newPrefix]) {
            fields[newPrefix] = {
              required: true,
              patternKey: '',
              detectedType: childType
            };
          }
        }
      }
    }

    if (!builtObjectTypes.has(objectTypeName)) {
      builtObjectTypes.add(objectTypeName);
      walkObject(obj);
    }
  }

  function walkRoot(v: any, prefix = '') {
    const t = detectType(v);

    if (t !== 'object' && t !== 'array') {
      const fieldName = prefix || 'root';
      rootFields[fieldName] = {
        required: true,
        patternKey: '',
        detectedType: t
      };
      return;
    }

    if (Array.isArray(v)) {
      const arrayPath = prefix ? `${prefix}[*]` : '[*]';

      if (v.length === 0) {
        rootFields[arrayPath] = {
          required: true,
          patternKey: '',
          detectedType: 'array'
        };
        return;
      }

      const elem = v[0];
      const elemType = detectType(elem);

      if (elemType === 'object') {
        const objectTypeName = inferObjectTypeNameFromPath(prefix || 'Item');
        buildObjectTypeFromSample(elem, objectTypeName);

        rootFields[arrayPath] = {
          required: true,
          patternKey: '',
          detectedType: 'array',
          objectType: objectTypeName
        };
      } else if (elemType === 'array' || elemType === 'object') {
        walkRoot(elem, arrayPath);
      } else {
        rootFields[arrayPath] = {
          required: true,
          patternKey: '',
          detectedType: elemType
        };
      }

      return;
    }

    for (const [k, child] of Object.entries(v)) {
      const newPrefix = prefix ? `${prefix}.${k}` : k;
      const childType = detectType(child);

      if (childType === 'object' || childType === 'array') {
        walkRoot(child, newPrefix);
      } else {
        rootFields[newPrefix] = {
          required: true,
          patternKey: '',
          detectedType: childType
        };
      }
    }
  }

  walkRoot(value);

  return { rootFields, objectTypes };
}

// ---------------------- React App ----------------------

const App: React.FC = () => {
  const [rawJson, setRawJson] = useState('');
  const [typeName, setTypeName] = useState('MyDto');

  const [rootFields, setRootFields] = useState<FieldsConfig>({});
  const [objectTypes, setObjectTypes] = useState<Record<string, FieldsConfig>>({});

  const [patterns, setPatterns] = useState<PatternsMap>({});
  const [generatedJson, setGeneratedJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [newPatternKey, setNewPatternKey] = useState('');
  const [newPatternValue, setNewPatternValue] = useState('');
  const [patternError, setPatternError] = useState<string | null>(null);

  const [newObjectTypeName, setNewObjectTypeName] = useState('');
  const [objectTypeError, setObjectTypeError] = useState<string | null>(null);
  const [objectTypeFieldDrafts, setObjectTypeFieldDrafts] = useState<Record<string, string>>({});

  const [existingJson, setExistingJson] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPatterns() {
      try {
        const res = await fetch(API_BASE + '/api/patterns');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        setPatterns(data);
      } catch (e) {
        console.error(e);
        setError('Failed to load patterns from backend');
      }
    }
    loadPatterns();
  }, []);

  const handleAnalyze = () => {
    setError(null);
    try {
      const parsed = JSON.parse(rawJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('Root JSON must be an object');
        return;
      }

      const { rootFields, objectTypes } = analyzeJsonToConfigs(parsed);

      setRootFields(rootFields);
      setObjectTypes(objectTypes);
    } catch (e: any) {
      setError('Invalid JSON: ' + e.message);
    }
  };

  const updateRootField = (fieldName: string, patch: Partial<FieldValidationConfig>) => {
    setRootFields(prev => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], ...patch }
    }));
  };

  const updateObjectTypeField = (
    objectTypeName: string,
    fieldName: string,
    patch: Partial<FieldValidationConfig>
  ) => {
    setObjectTypes(prev => ({
      ...prev,
      [objectTypeName]: {
        ...prev[objectTypeName],
        [fieldName]: {
          ...prev[objectTypeName][fieldName],
          ...patch
        }
      }
    }));
  };

  const handleAddPattern = () => {
    setPatternError(null);

    const key = newPatternKey.trim();
    const val = newPatternValue.trim();

    if (!key) {
      setPatternError('PatternKey is required');
      return;
    }
    if (!val) {
      setPatternError('Pattern value is required (e.g. regex:..., int:min:max)');
      return;
    }

    if (/\s/.test(key)) {
      setPatternError('PatternKey should not contain spaces');
      return;
    }

    if (patterns[key]) {
      console.warn(`Overriding existing pattern: ${key}`);
    }

    setPatterns(prev => ({
      ...prev,
      [key]: val
    }));

    setNewPatternKey('');
    setNewPatternValue('');
  };

  const handleAddObjectType = () => {
    setObjectTypeError(null);
    const name = newObjectTypeName.trim();
    if (!name) {
      setObjectTypeError('ObjectType name is required');
      return;
    }
    if (objectTypes[name]) {
      setObjectTypeError('ObjectType already exists');
      return;
    }
    setObjectTypes(prev => ({
      ...prev,
      [name]: {}
    }));
    setNewObjectTypeName('');
  };

  const handleAddObjectTypeField = (objectTypeName: string) => {
    const draft = (objectTypeFieldDrafts[objectTypeName] ?? '').trim();
    if (!draft) return;

    setObjectTypes(prev => ({
      ...prev,
      [objectTypeName]: {
        ...prev[objectTypeName],
        [draft]: {
          required: true,
          patternKey: '',
          detectedType: 'unknown'
        }
      }
    }));

    setObjectTypeFieldDrafts(prev => ({
      ...prev,
      [objectTypeName]: ''
    }));
  };

  const handleGenerate = () => {
    const typesEntry: Record<string, any> = {};
    for (const [fieldName, cfg] of Object.entries(rootFields)) {
      const fieldJson: any = {
        Required: cfg.required
      };

      if (cfg.patternKey) {
        fieldJson.PatternKey = cfg.patternKey;
      }

      if (typeof cfg.minLength === 'number') fieldJson.MinLength = cfg.minLength;
      if (typeof cfg.maxLength === 'number') fieldJson.MaxLength = cfg.maxLength;

      if (cfg.objectType) {
        fieldJson.ObjectType = cfg.objectType;
      }

      typesEntry[fieldName] = fieldJson;
    }

    const objectTypesJson: Record<string, Record<string, any>> = {};
    for (const [otName, fields] of Object.entries(objectTypes)) {
      const otEntry: Record<string, any> = {};
      for (const [fieldName, cfg] of Object.entries(fields)) {
        const fieldJson: any = {
          Required: cfg.required
        };
        if (cfg.patternKey) fieldJson.PatternKey = cfg.patternKey;
        if (typeof cfg.minLength === 'number') fieldJson.MinLength = cfg.minLength;
        if (typeof cfg.maxLength === 'number') fieldJson.MaxLength = cfg.maxLength;
        otEntry[fieldName] = fieldJson;
      }
      objectTypesJson[otName] = otEntry;
    }

    const out = {
      Validation: {
        Patterns: patterns,
        ObjectTypes: objectTypesJson,
        Types: {
          [typeName]: typesEntry
        }
      }
    };

    setGeneratedJson(JSON.stringify(out, null, 2));
  };

  const handleLoadExisting = () => {
    setLoadError(null);
    try {
      const parsed = JSON.parse(existingJson);
      if (!parsed || typeof parsed !== 'object') {
        setLoadError('Root must be an object');
        return;
      }

      const validation = (parsed as any).Validation;
      if (!validation || typeof validation !== 'object') {
        setLoadError('Missing Validation section');
        return;
      }

      if (validation.Patterns && typeof validation.Patterns === 'object') {
        setPatterns(validation.Patterns as PatternsMap);
      }

      const loadedObjectTypes: Record<string, FieldsConfig> = {};
      if (validation.ObjectTypes && typeof validation.ObjectTypes === 'object') {
        for (const [otName, fields] of Object.entries(validation.ObjectTypes as any)) {
          const cfg: FieldsConfig = {};
          for (const [fieldName, fieldCfg] of Object.entries(fields as any)) {
            const fc = fieldCfg as any;
            cfg[fieldName] = {
              required: !!fc.Required,
              patternKey: fc.PatternKey ?? '',
              detectedType: 'unknown',
              minLength: typeof fc.MinLength === 'number' ? fc.MinLength : undefined,
              maxLength: typeof fc.MaxLength === 'number' ? fc.MaxLength : undefined
            };
          }
          loadedObjectTypes[otName] = cfg;
        }
      }
      setObjectTypes(loadedObjectTypes);

      if (!validation.Types || typeof validation.Types !== 'object') {
        setLoadError('Missing Validation.Types');
        return;
      }

      const typeKeys = Object.keys(validation.Types as any);
      if (typeKeys.length === 0) {
        setLoadError('Validation.Types is empty');
        return;
      }

      const chosenTypeName = typeKeys[0];
      setTypeName(chosenTypeName);

      const typeFields = (validation.Types as any)[chosenTypeName] as Record<string, any>;
      const loadedRootFields: FieldsConfig = {};
      for (const [fieldName, fieldCfg] of Object.entries(typeFields)) {
        const fc = fieldCfg as any;
        loadedRootFields[fieldName] = {
          required: !!fc.Required,
          patternKey: fc.PatternKey ?? '',
          detectedType: 'unknown',
          minLength: typeof fc.MinLength === 'number' ? fc.MinLength : undefined,
          maxLength: typeof fc.MaxLength === 'number' ? fc.MaxLength : undefined,
          objectType: typeof fc.ObjectType === 'string' ? fc.ObjectType : undefined
        };
      }
      setRootFields(loadedRootFields);
    } catch (e: any) {
      setLoadError('Invalid JSON: ' + e.message);
    }
  };

  const patternOptions = Object.keys(patterns).sort();
  const objectTypeOptions = Object.keys(objectTypes).sort();

  const renderFieldRow = (
    name: string,
    cfg: FieldValidationConfig,
    onChange: (patch: Partial<FieldValidationConfig>) => void,
    isRoot: boolean
  ) => (
    <Paper key={name} sx={{ p: 2, mb: 1 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1">
          <strong>{name}</strong>{' '}
          <Typography component="span" variant="body2" color="text.secondary">
            ({cfg.detectedType})
          </Typography>
          {isRoot && cfg.objectType && (
            <Chip label={`ObjectType: ${cfg.objectType}`} size="small" sx={{ ml: 1 }} />
          )}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControlLabel
            control={
              <Checkbox
                checked={cfg.required}
                onChange={e => onChange({ required: e.target.checked })}
              />
            }
            label="Required"
          />
          <TextField
            select
            label="PatternKey"
            value={cfg.patternKey}
            onChange={e => onChange({ patternKey: e.target.value })}
            size="small"
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">(none)</MenuItem>
            {patternOptions.map(p => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label="MinLength"
            value={cfg.minLength ?? ''}
            onChange={e =>
              onChange({
                minLength: e.target.value === '' ? undefined : Number(e.target.value)
              })
            }
            size="small"
            sx={{ width: 120 }}
          />
          <TextField
            type="number"
            label="MaxLength"
            value={cfg.maxLength ?? ''}
            onChange={e =>
              onChange({
                maxLength: e.target.value === '' ? undefined : Number(e.target.value)
              })
            }
            size="small"
            sx={{ width: 120 }}
          />
          {isRoot && (
            <TextField
              select
              label="ObjectType"
              value={cfg.objectType ?? ''}
              onChange={e =>
                onChange({
                  objectType: e.target.value === '' ? undefined : e.target.value
                })
              }
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">(none)</MenuItem>
              {objectTypeOptions.map(ot => (
                <MenuItem key={ot} value={ot}>
                  {ot}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </Stack>
    </Paper>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        Validation JSON Builder (with ObjectTypes)
      </Typography>

      {/* 1) JSON input */}
      <Stack component={Paper} spacing={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">1. Paste sample JSON (req/res)</Typography>
        <TextField
          label="Sample JSON"
          placeholder='{"CustomerId":"...","Email":"...","Age":42}'
          value={rawJson}
          onChange={e => setRawJson(e.target.value)}
          multiline
          minRows={6}
          InputProps={{ sx: { fontFamily: 'monospace' } }}
          fullWidth
        />
        <TextField
          label="Type name (in Validation.Types)"
          value={typeName}
          onChange={e => setTypeName(e.target.value)}
          size="small"
          sx={{ maxWidth: 360 }}
        />
        <Box>
          <Button variant="contained" onClick={handleAnalyze}>
            Analyze JSON → Root Fields & ObjectTypes
          </Button>
        </Box>
        {error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        )}
      </Stack>

      {/* 2) Pattern editor */}
      <Stack component={Paper} spacing={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">2. Manage Patterns (Validation.Patterns)</Typography>
        <Stack spacing={2}>
          <Typography variant="subtitle2">Add new pattern</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="PatternKey"
              placeholder="AlphaNumeric"
              value={newPatternKey}
              onChange={e => setNewPatternKey(e.target.value)}
              size="small"
            />
            <TextField
              label="Value"
              placeholder="regex:^[0-9]{1,6}$  or  int:1:10"
              value={newPatternValue}
              onChange={e => setNewPatternValue(e.target.value)}
              size="small"
              fullWidth
            />
            <Button variant="outlined" onClick={handleAddPattern}>
              Add / Override
            </Button>
          </Stack>
          {patternError && (
            <Typography color="error" variant="body2">
              {patternError}
            </Typography>
          )}
        </Stack>
        <Divider />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Current patterns:
          </Typography>
          <List
            sx={{
              maxHeight: 180,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1
            }}
          >
            {Object.entries(patterns).map(([key, val]) => (
              <ListItem key={key} dense>
                <ListItemText
                  primaryTypographyProps={{ component: 'div' }}
                  primary={
                    <>
                      <code>{key}</code>: <code>{val}</code>
                    </>
                  }
                />
              </ListItem>
            ))}
            {Object.keys(patterns).length === 0 && (
              <ListItem>
                <ListItemText primary="No patterns loaded yet." />
              </ListItem>
            )}
          </List>
        </Box>
      </Stack>

      {/* 3) ObjectTypes editor */}
      <Stack component={Paper} spacing={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">3. Object types (Validation.ObjectTypes)</Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="New ObjectType name"
            placeholder="Role, Task, Member..."
            value={newObjectTypeName}
            onChange={e => setNewObjectTypeName(e.target.value)}
            size="small"
            sx={{ maxWidth: 260 }}
          />
          <Button variant="outlined" onClick={handleAddObjectType}>
            Add ObjectType
          </Button>
          {objectTypeError && (
            <Typography color="error" variant="body2">
              {objectTypeError}
            </Typography>
          )}
        </Stack>

        {Object.keys(objectTypes).length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No ObjectTypes yet. They will be inferred from JSON arrays of objects, or you can add
            them manually.
          </Typography>
        )}

        {Object.entries(objectTypes).map(([otName, fields]) => (
          <Paper key={otName} sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              ObjectType: <strong>{otName}</strong>
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="New field path (relative)"
                placeholder="name, permissions[*], audit.history[*].action"
                size="small"
                fullWidth
                value={objectTypeFieldDrafts[otName] ?? ''}
                onChange={e =>
                  setObjectTypeFieldDrafts(prev => ({
                    ...prev,
                    [otName]: e.target.value
                  }))
                }
              />
              <Button variant="outlined" onClick={() => handleAddObjectTypeField(otName)}>
                Add field
              </Button>
            </Stack>
            {Object.keys(fields).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No fields yet.
              </Typography>
            )}
            {Object.entries(fields).map(([fieldName, cfg]) =>
              renderFieldRow(fieldName, cfg, patch =>
                updateObjectTypeField(otName, fieldName, patch),
              false)
            )}
          </Paper>
        ))}
      </Stack>

      {/* 4) Root fields editor */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h6">4. Root fields (Validation.Types[{typeName}])</Typography>
        {Object.keys(rootFields).length === 0 && (
          <Typography variant="body2">No fields yet.</Typography>
        )}
        {Object.entries(rootFields).map(([name, cfg]) =>
          renderFieldRow(name, cfg, patch => updateRootField(name, patch), true)
        )}
      </Stack>

      {/* 5) Load existing Validation JSON */}
      <Stack component={Paper} spacing={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6">5. Load existing Validation JSON</Typography>
        <TextField
          label="Existing Validation JSON"
          value={existingJson}
          onChange={e => setExistingJson(e.target.value)}
          multiline
          minRows={6}
          InputProps={{ sx: { fontFamily: 'monospace' } }}
          fullWidth
        />
        <Button variant="outlined" onClick={handleLoadExisting}>
          Load into editor
        </Button>
        {loadError && (
          <Typography color="error" variant="body2">
            {loadError}
          </Typography>
        )}
      </Stack>

      {/* 6) Output */}
      <Stack component={Paper} spacing={2} sx={{ p: 2 }}>
        <Typography variant="h6">6. Generated Validation JSON</Typography>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={Object.keys(rootFields).length === 0}
        >
          Generate
        </Button>
        <TextField
          label="Output JSON"
          value={generatedJson}
          multiline
          minRows={10}
          InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }}
          fullWidth
        />
      </Stack>
    </Container>
  );
};

export default App;
