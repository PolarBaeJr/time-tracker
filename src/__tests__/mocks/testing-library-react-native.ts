/**
 * Mock @testing-library/react-native for Jest testing
 *
 * This provides a minimal implementation of the testing library APIs
 * needed for testing components without the full RN runtime.
 */

import * as React from 'react';

interface RenderResult {
  getByText: (text: string | RegExp) => Element;
  getByTestId: (testId: string) => Element;
  getByLabelText: (label: string) => Element;
  getByPlaceholderText: (placeholder: string) => Element;
  getAllByTestId: (testId: string) => Element[];
  queryByText: (text: string | RegExp) => Element | null;
  queryByTestId: (testId: string) => Element | null;
  rerender: (ui: React.ReactElement) => void;
  toJSON: () => object | null;
  container: Element;
  unmount: () => void;
}

interface Element {
  props: {
    testID?: string;
    accessibilityLabel?: string;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    children?: React.ReactNode;
    [key: string]: unknown;
  };
  type: string | React.ComponentType;
  children: Element[] | null;
}

function flattenTree(node: Element | null, results: Element[] = []): Element[] {
  if (!node) return results;
  results.push(node);
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child === 'object' && child !== null) {
        flattenTree(child as Element, results);
      }
    }
  }
  return results;
}

function getTextContent(node: Element): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.children) {
    return node.children
      .map((child) => {
        if (typeof child === 'string') return child;
        if (typeof child === 'object') return getTextContent(child as Element);
        return '';
      })
      .join('');
  }
  return '';
}

function createTreeFromReactElement(element: React.ReactElement): Element {
  const { type, props } = element;
  const children: Element[] = [];
  const elementProps = props as Record<string, unknown>;

  if (elementProps.children) {
    const childArray = Array.isArray(elementProps.children)
      ? elementProps.children
      : [elementProps.children];
    for (const child of childArray) {
      if (React.isValidElement(child)) {
        children.push(createTreeFromReactElement(child as React.ReactElement));
      } else if (typeof child === 'string' || typeof child === 'number') {
        children.push({
          type: 'Text',
          props: { children: String(child) },
          children: null,
        });
      }
    }
  }

  return {
    type: typeof type === 'string' ? type : (type as React.ComponentType).name || 'Unknown',
    props: { ...(elementProps as object) },
    children: children.length > 0 ? children : null,
  };
}

export function render(ui: React.ReactElement): RenderResult {
  const tree = createTreeFromReactElement(ui);
  const allNodes = flattenTree(tree);

  const getByText = (text: string | RegExp): Element => {
    for (const node of allNodes) {
      const content = getTextContent(node);
      if (typeof text === 'string' && content === text) return node;
      if (text instanceof RegExp && text.test(content)) return node;
    }
    throw new Error(`Unable to find element with text: ${text}`);
  };

  const getByTestId = (testId: string): Element => {
    const found = allNodes.find((node) => node.props.testID === testId);
    if (!found) throw new Error(`Unable to find element with testID: ${testId}`);
    return found;
  };

  const getByLabelText = (label: string): Element => {
    const found = allNodes.find((node) => node.props.accessibilityLabel === label);
    if (!found) throw new Error(`Unable to find element with accessibilityLabel: ${label}`);
    return found;
  };

  const getByPlaceholderText = (placeholder: string): Element => {
    const found = allNodes.find((node) => node.props.placeholder === placeholder);
    if (!found) throw new Error(`Unable to find element with placeholder: ${placeholder}`);
    return found;
  };

  const getAllByTestId = (testId: string): Element[] => {
    return allNodes.filter((node) => node.props.testID === testId);
  };

  const queryByText = (text: string | RegExp): Element | null => {
    try {
      return getByText(text);
    } catch {
      return null;
    }
  };

  const queryByTestId = (testId: string): Element | null => {
    return allNodes.find((node) => node.props.testID === testId) || null;
  };

  let currentUi = ui;

  return {
    getByText,
    getByTestId,
    getByLabelText,
    getByPlaceholderText,
    getAllByTestId,
    queryByText,
    queryByTestId,
    rerender: (newUi: React.ReactElement) => {
      currentUi = newUi;
      // In a real implementation, this would update the tree
    },
    toJSON: () => tree,
    container: tree,
    unmount: () => {},
  };
}

export function fireEvent(element: Element, eventName: string): void {
  const handlerName = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
  if (element.props[handlerName]) {
    (element.props[handlerName] as () => void)();
  }
}

fireEvent.press = (element: Element): void => {
  if (element.props.onPress) {
    (element.props.onPress as () => void)();
  }
};

fireEvent.changeText = (element: Element, text: string): void => {
  if (element.props.onChangeText) {
    (element.props.onChangeText as (t: string) => void)(text);
  }
};

export function waitFor<T>(
  callback: () => T | Promise<T>,
  options?: { timeout?: number; interval?: number }
): Promise<T> {
  return Promise.resolve(callback());
}

export function act(callback: () => void | Promise<void>): void {
  callback();
}

export default {
  render,
  fireEvent,
  waitFor,
  act,
};
