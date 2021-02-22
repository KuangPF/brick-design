import { each, get, isEmpty } from 'lodash';
import {
	BrickAction,
	ChildNodesType,
	PageConfigType,
	ComponentSchemaType,
	PropsConfigSheetType,
	PropsNodeType,
	SelectedInfoType,
	StateType, BrickDesignStateType, ConfigType,

} from '../types';
import { ReducerType } from '../reducers';
import { BrickdStoreType } from '../store';
import { legoState } from '../reducers/handlePageBrickdState';

/**
 * 根节点key
 */
export const ROOT = '0';

/**
 * 复制组件
 * @param pageConfig
 * @param selectedKey
 * @param newKey
 */
export interface HandleInfoType {
	pageConfig: PageConfigType
	propsConfigSheet: PropsConfigSheetType
}

export const copyConfig = (
	handleInfo: HandleInfoType,
	selectedKey: string,
	newKey: number,
) => {
	const { pageConfig, propsConfigSheet } = handleInfo;
	if (propsConfigSheet[selectedKey]) {
		propsConfigSheet[newKey] = propsConfigSheet[selectedKey];
	}
	const vDom = pageConfig[selectedKey];
	const childNodes = vDom.childNodes;
	if (!childNodes) {
		pageConfig[newKey] = vDom;
	} else {
		const newVDom = { ...vDom };
		pageConfig[newKey] = newVDom;
		if (Array.isArray(childNodes)) {
			newVDom.childNodes = copyChildNodes(handleInfo, childNodes);
		} else {
			const newChildNodes: PropsNodeType = {};
			each(childNodes, (nodes, propName) => {
				newChildNodes[propName] = copyChildNodes(handleInfo, nodes!);
			});
			newVDom.childNodes = newChildNodes;
		}
	}
};

function copyChildNodes(handleInfo: HandleInfoType, childNodes: string[]) {
	const { pageConfig } = handleInfo;
	const newChildKeys: string[] = [];
	for (const oldKey of childNodes) {
		const newChildKey = getNewKey(pageConfig);
		newChildKeys.push(`${newChildKey}`);
		copyConfig(handleInfo, oldKey, newChildKey);
	}
	return newChildKeys;
}

export function deleteChildNodes(
	handleInfo: HandleInfoType,
	childNodes: ChildNodesType,
	propName?: string,
) {
	if (Array.isArray(childNodes)) {
		deleteArrChild(handleInfo, childNodes);
	} else {
		each(childNodes, (propChildNodes, key) => {
			if (propName) {
				if (key === propName) {
					deleteArrChild(handleInfo, propChildNodes!);
				}
			} else {
				deleteArrChild(handleInfo, propChildNodes!);
			}
		});
	}
}

function deleteArrChild(handleInfo: HandleInfoType, childNodes: string[]) {
	for (const key of childNodes) {
		const childNodesInfo = handleInfo.pageConfig[key].childNodes;
		if (childNodesInfo) {
			deleteChildNodes(handleInfo, childNodesInfo);
		}

		delete handleInfo.pageConfig[key];
		delete handleInfo.propsConfigSheet[key];
	}
}

/**
 * 获取路径
 * */
export function getLocation(key: string, propName?: string): string[] {
	const basePath = [key, 'childNodes'];
	return propName ? [...basePath, propName] : basePath;
}

export interface VDOMAndPropsConfigType {
	pageConfig: PageConfigType
	propsConfigSheet: PropsConfigSheetType
}

export interface DragVDomAndPropsConfigType {
	vDOMCollection: PageConfigType
	propsConfigCollection?: PropsConfigSheetType
}

/**
 * 生成新的Key
 * @param dragVDOMAndPropsConfig
 * @param rootKey
 */
export const generateNewKey = (
	dragVDOMAndPropsConfig: DragVDomAndPropsConfigType,
	rootKey: number,
) => {
	const { vDOMCollection, propsConfigCollection } = dragVDOMAndPropsConfig;
	const keyMap: { [key: string]: string } = {};
	const newVDOMCollection: PageConfigType = {};
	let newPropsConfigCollection: PropsConfigSheetType | undefined;
	let newKey = rootKey;
	each(vDOMCollection, (vDom, key) => {
		++newKey;
		if (key === ROOT) {
			newKey = rootKey;
		}
		keyMap[key] = `${newKey}`;
		newVDOMCollection[newKey] = vDom;
	});

	each(newVDOMCollection, (vDom) => {
		const childNodes = vDom.childNodes;
		if (!childNodes) return;
		if (Array.isArray(childNodes)) {
			vDom.childNodes = childNodes.map((key) => keyMap[key]);
		} else {
			const newChildNodes: PropsNodeType = {};
			each(childNodes, (nodes, propName) => {
				newChildNodes[propName] = nodes!.map((key) => keyMap[key]);
			});
			vDom.childNodes = newChildNodes;
		}
	});
	if (propsConfigCollection) {
		newPropsConfigCollection = {};
		each(propsConfigCollection, (v, k) => {
			newPropsConfigCollection![keyMap[k]] = v;
		});
	}

	return { newVDOMCollection, newPropsConfigCollection };
};

/**
 * 获取字段在props中的位置
 * @param fieldConfigLocation
 * @returns {string}
 */
export const getFieldInPropsLocation = (fieldConfigLocation: string) => {
	return fieldConfigLocation
		.split('.')
		.filter((location) => location !== 'childPropsConfig');
};

/**
 * 处理子节点非空
 * @param selectedInfo
 * @param pageConfig
 * @param payload
 */
export const handleRequiredHasChild = (
	selectedInfo: SelectedInfoType,
	pageConfig: PageConfigType,
) => {
	const { selectedKey, propName: selectedPropName } = selectedInfo;
	const { componentName, childNodes } = pageConfig[selectedKey];
	const { nodePropsConfig, isRequired } = getComponentConfig(componentName);
	return (
		(selectedPropName &&
			nodePropsConfig![selectedPropName].isRequired &&
			!get(childNodes, selectedPropName)) ||
		(isRequired && !childNodes)
	);
};

export function shallowEqual(objA: any, objB: any) {
	for (const k of Object.keys(objA)) {
		if (objA[k] !== objB[k]) return false;
	}
	return true;
}

export function deleteChildNodesKey(
	childNodes: ChildNodesType,
	deleteKey: string,
	parentPropName?: string,
) {
	if (Array.isArray(childNodes)) {
		const resultChildNodes = childNodes.filter(
			(nodeKey: string) => nodeKey !== deleteKey,
		);
		return restObject(resultChildNodes);
	} else {
		const resultChildNodes = childNodes[parentPropName!]!.filter(
			(nodeKey: string) => nodeKey !== deleteKey,
		);
		if (resultChildNodes.length === 0) {
			delete childNodes[parentPropName!];
		} else {
			childNodes[parentPropName!] = resultChildNodes;
		}
		return restObject(childNodes);
	}
}

export function getComponentConfig(
	componentName: string,
): ComponentSchemaType {
	const componentSchemasMap = get(getBrickdConfig(), [
		'componentSchemasMap',
	]);
	if (!componentSchemasMap) {
		error('Component configuration information set not found！! !');
	}
	const componentSchema = componentSchemasMap[componentName];
	if (componentName && !componentSchema) {
		warn(`${componentName} configuration information not found！! !`);
	}
	return componentSchema;
}

export function isContainer(componentName: string) {
	return  !get(getBrickdConfig(), ['componentSchemasMap',componentName,'isNonContainer']);
}

export function error(msg: string) {
	console.error(msg);
	throw new Error(msg);
}

export function warn(msg: string) {
	const warn = getWarn();
	if (warn) {
		warn(msg);
	} else {
		console.warn(msg);
	}
	return true;
}

export function getNewKey(pageConfig: PageConfigType) {
	const lastKey = Object.keys(pageConfig).pop();
	return Number(lastKey) + 1;
}

export function restObject(obj: any, field?: string) {
	if (field) {
		delete obj[field];
	}
	if (Object.keys(obj).length === 0) return undefined;
	return obj;
}

export function handleRules(
	pageConfig: PageConfigType,
	dragKey: string,
	selectedKey: string,
	propName?: string,
	isForbid?: boolean,
) {
	/**
	 * 获取当前拖拽组件的父组件约束，以及属性节点配置信息
	 */
	const dragComponentName = pageConfig[dragKey!].componentName;
	const dropComponentName = pageConfig[selectedKey!].componentName;
	const { fatherNodesRule } = getComponentConfig(dragComponentName);
	const { nodePropsConfig, childNodesRule } = getComponentConfig(
		dropComponentName,
	);

	/**
	 * 子组件约束限制，减少不必要的组件错误嵌套
	 */
	const childRules = propName
		? nodePropsConfig![propName].childNodesRule
		: childNodesRule;
	if (childRules && !childRules.includes(dragComponentName)) {
		!isForbid &&
			warn(
				`${
					propName || dropComponentName
				}:only allow drag and drop to add${childRules.toString()}`,
			);
		return true;
	}
	/**
	 * 父组件约束限制，减少不必要的组件错误嵌套
	 */
	if (
		fatherNodesRule &&
		!fatherNodesRule.includes(
			propName ? `${dropComponentName}.${propName}` : `${dropComponentName}`,
		)
	) {
		!isForbid &&
			warn(
				`${dragComponentName}:Only allowed as a child node or attribute node of${fatherNodesRule.toString()}`,
			);
		return true;
	}
	return false;
}

export function combineReducers(
	brickReducer: ReducerType,
	customReducer?: ReducerType,
): ReducerType {
	return (state: BrickDesignStateType | undefined, action: BrickAction): BrickDesignStateType => {
		const newState = brickReducer(state, action);
		if (customReducer) {
			return customReducer(newState, action);
		} else {
			return newState;
		}
	};
}

export function createTemplateConfigs(
	templateConfigs: PageConfigType,
	templatePropsConfigSheet: PropsConfigSheetType,
	pageConfig: PageConfigType,
	propsConfigSheet: PropsConfigSheetType,
	childNodes: ChildNodesType,
) {
	if (Array.isArray(childNodes)) {
		for (const key of childNodes) {
			templateConfigs[key] = pageConfig[key];
			if (propsConfigSheet[key]) {
				templatePropsConfigSheet[key] = propsConfigSheet[key];
			}
			const { childNodes } = templateConfigs[key];
			if (childNodes)
				createTemplateConfigs(
					templateConfigs,
					templatePropsConfigSheet,
					pageConfig,
					propsConfigSheet,
					childNodes,
				);
		}
	} else {
		each(childNodes, (childKeys) => {
			if (!isEmpty(childKeys))
				createTemplateConfigs(
					templateConfigs,
					templatePropsConfigSheet,
					pageConfig,
					propsConfigSheet,
					childKeys,
				);
		});
	}
}

export function createTemplate(state: StateType) {
	const { selectedInfo, pageConfig, propsConfigSheet } = state;
	const { selectedKey } = selectedInfo;
	const templateConfigs = { [ROOT]: pageConfig[selectedKey] };
	const templatePropsConfigSheet = { [ROOT]: propsConfigSheet[selectedKey] };
	const { childNodes } = pageConfig[selectedKey];
	if (!isEmpty(childNodes)) {
		createTemplateConfigs(
			templateConfigs,
			templatePropsConfigSheet,
			pageConfig,
			propsConfigSheet,
			childNodes,
		);
	}
	return { templateConfigs, templatePropsConfigSheet };
}

export function createActions(action: BrickAction) {
	return getStore().dispatch(action);
}

let CURRENT_PAGE_NAME:null|string=null;
export const setPageName=(pageName:null|string)=>CURRENT_PAGE_NAME=pageName;
export const getPageName=()=>CURRENT_PAGE_NAME;

let STORE:BrickdStoreType<BrickDesignStateType,BrickAction> | null=null;
export const setStore=(store:BrickdStoreType<BrickDesignStateType,BrickAction> | null)=>STORE=store;
export const getStore=()=>STORE;

let BRICKD_CONFIG:ConfigType|null=null;
export const getBrickdConfig=()=>BRICKD_CONFIG;
export const setBrickdConfig=(config:ConfigType|null)=>BRICKD_CONFIG=config;

export type WarnType=(msg: string) => void
let WARN:WarnType|null=null;

export const getWarn=()=>WARN;
export const setWarn=(warn:WarnType|null)=>WARN=warn;

export function getPageState(){
	const pageName=getPageName();
	return get(getStore().getState(),pageName,legoState);
};
export const cleanStateCache=()=>{
	setBrickdConfig(null);
	setWarn(null);
	setStore(null);
	setPageName(null);
};
