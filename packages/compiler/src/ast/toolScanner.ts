import { Project, Node, SyntaxKind, ArrayLiteralExpression } from 'ts-morph';

export interface ToolMeta {
  name: string;
  description: string;
  properties: Record<string, { type: string; description?: string }>;
  required: string[];
}

export function scanToolsFile(filePath: string): ToolMeta[] {
  const project = new Project({ useInMemoryFileSystem: false });
  const sourceFile = project.addSourceFileAtPath(filePath);
  const tools: ToolMeta[] = [];

  // Look for exported TOOLS or SAAS_TOOLS array literals or object literals
  const arrays = sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression);
  for (const arr of arrays) {
    for (const elem of arr.getElements()) {
      if (Node.isObjectLiteralExpression(elem)) {
        const nameProp = elem.getProperty('name');
        const descProp = elem.getProperty('description');
        const schemaProp = elem.getProperty('inputSchema');

        if (nameProp && Node.isPropertyAssignment(nameProp)) {
          const nameInit = nameProp.getInitializer();
          const name = nameInit ? nameInit.getText().replace(/['"]/g, '') : '';

          let description = '';
          if (descProp && Node.isPropertyAssignment(descProp)) {
            const descInit = descProp.getInitializer();
            description = descInit ? descInit.getText().replace(/['"]/g, '') : '';
          }

          const properties: Record<string, { type: string; description?: string }> = {};
          const required: string[] = [];

          if (schemaProp && Node.isPropertyAssignment(schemaProp)) {
            const schemaInit = schemaProp.getInitializer();
            if (schemaInit && Node.isObjectLiteralExpression(schemaInit)) {
              const propsProp = schemaInit.getProperty('properties');
              if (propsProp && Node.isPropertyAssignment(propsProp)) {
                const propsInit = propsProp.getInitializer();
                if (propsInit && Node.isObjectLiteralExpression(propsInit)) {
                  for (const prop of propsInit.getProperties()) {
                    if (Node.isPropertyAssignment(prop)) {
                      const propName = prop.getName();
                      const propInit = prop.getInitializer();
                      let propType = 'string';
                      let propDesc: string | undefined;

                      if (propInit && Node.isObjectLiteralExpression(propInit)) {
                        const typeField = propInit.getProperty('type');
                        if (typeField && Node.isPropertyAssignment(typeField)) {
                          propType = typeField.getInitializer()?.getText().replace(/['"]/g, '') ?? 'string';
                        }
                        const descField = propInit.getProperty('description');
                        if (descField && Node.isPropertyAssignment(descField)) {
                          propDesc = descField.getInitializer()?.getText().replace(/['"]/g, '');
                        }
                      }
                      properties[propName] = { type: propType, description: propDesc };
                    }
                  }
                }
              }

              const reqProp = schemaInit.getProperty('required');
              if (reqProp && Node.isPropertyAssignment(reqProp)) {
                const reqInit = reqProp.getInitializer();
                if (reqInit && Node.isArrayLiteralExpression(reqInit)) {
                  for (const elem of reqInit.getElements()) {
                    required.push(elem.getText().replace(/['"]/g, ''));
                  }
                }
              }
            }
          }

          if (name) {
            tools.push({ name, description, properties, required });
          }
        }
      }
    }
  }

  return tools;
}
