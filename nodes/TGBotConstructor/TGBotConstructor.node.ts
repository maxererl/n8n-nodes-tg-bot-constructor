/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import {
	IExecuteFunctions,
} from 'n8n-workflow';

import type { Readable } from 'stream';

import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeParameters,
	NodeOperationError,
	IHttpRequestMethods,
	IBinaryData,
	BINARY_ENCODING,
	NodeConnectionType
} from 'n8n-workflow';

import {
	addAdditionalFields,
	apiRequest,
	IMarkupKeyboard
} from './GenericFunctions';

const configuredOutputs = (parameters: INodeParameters) => {
		const mainOutput = {
			type: 'main',
			displayName: 'main',
		};
		const inlineButtons = (((parameters.inlineKeyboard as IDataObject)?.rows as IDataObject[]) ?? []).flatMap(r => (r?.row as IDataObject[] ?? [])).flatMap(row => row?.buttons as IDataObject[] ?? []) ?? [];
		const ruleOutputs = inlineButtons.map((inlineButton, index) => {
			(inlineButton.additionalFields as IDataObject).callback_data = index + 1;
			return {
				type: 'main',
				displayName: inlineButton.text || index.toString(),
			};
		});
		return [mainOutput, ...ruleOutputs];
};

const isCompletedNode = (path: string[] | undefined, userMap: string[] | undefined) => {
	if (!userMap || userMap.length === 0) return undefined;
	if (!path || path.length === 0) return Number(userMap[0]);
	return Number(userMap[path.length]);
};

const removeLooping = (nodeName: string, path: string[] | undefined, userMap: string[] | undefined) => {
	const i = Number(path?.indexOf(nodeName)) + 1; // returns NaN, 0 or index+1
	if (!path || !userMap || !i) return [path, userMap];
	return [path.slice(0, i-1), userMap.slice(0, i-1)];
}

export class TGBotConstructor implements INodeType {
	description: INodeTypeDescription = {
		// Basic node details will go here
		displayName: 'TGBotConstructor',
		name: 'tgBotConstructor',
		icon: 'file:TGBotConstructor.svg',
		group: ['transform'],
		version: 1,
		description: 'Chained telegram bots constructor',
		defaults: {
			name: 'TGBotConstructor',
		},
		inputs: [NodeConnectionType.Main],
		outputs: `={{(${configuredOutputs})($parameter)}}`,
		credentials: [
			{
				name: 'telegramApi',
				required: true,
			},
		],
		properties: [
			// Resources and operations will go here
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
					},
				],
				default: 'message',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a message',
						action: 'Send a message',
					}
				],
				default: 'sendMessage',
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '={{ $json.body?.message?.from?.id || $json.body.callback_query.from.id }}',
				displayOptions: {
					show: {
						operation: [
							'sendMessage'
						],
						resource: ['message'],
					},
				},
				required: true,
				description:
					'Unique identifier for the target chat or username, To find your chat ID ask @get_id_bot',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
						resource: ['message'],
					},
				},
				description: 'Text of the message to be sent',
			},
			{
				displayName: 'Reply Markup',
				name: 'replyMarkup',
				displayOptions: {
					show: {
						operation: [
							'sendMessage'
						],
						resource: ['message'],
					},
				},
				type: 'options',
				options: [
					{
						name: 'Inline Keyboard',
						value: 'inlineKeyboard',
					},
					{
						name: 'None',
						value: 'none',
					}
				],
				default: 'none',
				description: 'Keyboard of the message',
			},
			{
				displayName: 'Inline Keyboard',
				name: 'inlineKeyboard',
				placeholder: 'Add Keyboard Row',
				description: 'Adds an inline keyboard that appears right next to the message it belongs to',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true
				},
				displayOptions: {
					show: {
						replyMarkup: ['inlineKeyboard'],
						resource: ['message'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Rows',
						name: 'rows',
						values: [
							{
								displayName: 'Row',
								name: 'row',
								type: 'fixedCollection',
								description: 'Row with buttons',
								placeholder: 'Add Button',
								typeOptions: {
									multipleValues: true,
									sortable: true
								},
								default: {},
								options: [
									{
										displayName: 'Buttons',
										name: 'buttons',
										values: [
											{
												displayName: 'Text',
												name: 'text',
												type: 'string',
												default: '',
												description: 'Label text on the button',
											},
											{
												displayName: 'Additional Fields',
												name: 'additionalFields',
												type: 'collection',
												placeholder: 'Add Field',
												default: {},
												options: [
													{
														displayName: 'Callback Data',
														name: 'callback_data',
														type: 'string',
														default: '',
														description:
															'Data to be sent in a callback query to the bot when button is pressed, 1-64 bytes',
													}
												],
											}
										],
									},
								],
							},
						],
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						operation: [
							'sendMessage'
						],
						resource: ['message'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Edit Message ID',
						name: 'message_id',
						type: 'number',
						displayOptions: {
							hide: {
								'/operation': ['editMessageText'],
							},
						},
						// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-number
						default: '={{ $json.body?.callback_query?.message?.message_id }}',
						description: 'ID of the message in this chat that you want to edit',
					},
					{
						displayName: 'Media',
						name: 'media',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						placeholder: 'Add Media',
						default: [],
						options: [
							{
								displayName: 'Media Properties',
								name: 'mediaProperties',
								values: [
									{
										displayName: 'Type',
										name: 'type',
										type: 'options',
										options: [
											{
												name: 'Photo',
												value: 'photo',
											},
											{
												name: 'Document',
												value: 'document',
											},
										],
										default: 'photo',
										description: 'The type of media to be send',
									},
									{
										displayName: 'Source',
										name: 'url',
										type: 'string',
										default: '',
										required: true,
										placeholder: 'https://example.com/image.jpg',
										description: 'The URL or telegram file_id of the media file. Pass "attach://&lt;binary_field_name&gt;" if you want to send binary from input.',
									},
								],
							},
						],
					},
					{
						displayName: 'Reply To Message ID',
						name: 'reply_to_message_id',
						type: 'number',
						displayOptions: {
							hide: {
								'/operation': ['editMessageText'],
							},
						},
						default: 0,
						description: 'If the message is a reply, ID of the original message',
					},
					{
						displayName: 'Parse Mode',
						name: 'parse_mode',
						type: 'options',
						options: [
							{
								name: 'Markdown (Legacy)',
								value: 'Markdown',
							},
							{
								name: 'MarkdownV2',
								value: 'MarkdownV2',
							},
							{
								name: 'HTML',
								value: 'HTML',
							},
						],
						displayOptions: {
							show: {
								'/operation': [
									'sendMessage'
								],
							},
						},
						default: 'HTML',
						description: 'How to parse the text',
					},
				],
			}
		],
	};

	// The execute method will go here
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const inlineKeyboard = (this.getNodeParameter('replyMarkup', 0) as string !== 'none') ?
			this.getNodeParameter('inlineKeyboard', 0) as IMarkupKeyboard
			: undefined;

		const inlineButtons = (inlineKeyboard?.rows ?? []).flatMap(r => r?.row ?? []).flatMap(row => row?.buttons ?? []) ?? [];
		const returnArray: INodeExecutionData[][] = Array.from({length: inlineButtons.length}, () => []);

		// For Post
		let body: IDataObject;
		// For Query string
		let qs: IDataObject;

		let requestMethod: IHttpRequestMethods;
		let endpoint: string;

		const operation = this.getNodeParameter('operation', 0);
		const resource = this.getNodeParameter('resource', 0);

		for (let i = 0; i < items.length; i++) {
			const callback_query = (items[i].json?.body as IDataObject)?.callback_query as any;
			let userMap: string[] | undefined = callback_query?.data?.split(',');
			let nodesPath: string[] | undefined = items[i].json?.path as string[];

			// Remove looping, like node executed for the first time
			[nodesPath, userMap] = removeLooping(this.getNode().name, nodesPath, userMap);

			// Get index to rout or undefined if message should be sent
			const routingIndex = isCompletedNode(nodesPath, userMap);

			// Routing logic if roadmap is persist and node already completed
			if (routingIndex) {
				// Making item path
				if (!nodesPath) items[i].json.path = [this.getNode().name];
				else nodesPath.push(this.getNode().name);

				returnData.push(...this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray([items[i]] as IDataObject[]),
					{ itemData: { item: i } },
				));
				returnArray[Number(routingIndex)] = returnData;
			} else {

				// Send message if roadmap is not persist or node is not completed

				try {
					// Reset all values
					requestMethod = 'POST';
					endpoint = '';
					body = {};
					qs = {};
					let formData;

					if (resource === 'message') {
						if (operation === 'sendMessage') {
							// ----------------------------------
							//         message:sendMessage
							// ----------------------------------

							// TODO: Make sendPhoto/sendDocument and editMessageMedia
							const additionalFields = this.getNodeParameter('additionalFields', i);
							const mediaProperties = (additionalFields?.media as IDataObject)?.mediaProperties as IDataObject[];
							const binaryData = items[i].binary as IDataObject;

							body.chat_id = this.getNodeParameter('chatId', i) as string;

							// Set new callback_data
							inlineButtons.forEach((inlineButton) => {
								(inlineButton.additionalFields as IDataObject).callback_data =
									((userMap && userMap.length !== 0)? userMap + ',' : '') + ((inlineButton.additionalFields as IDataObject).callback_data as string);
							});

							if (!Number(additionalFields?.message_id)) {
								// If send new message
								if (!mediaProperties?.length) {
									// If no media attached
									endpoint = 'sendMessage';
									body.text = this.getNodeParameter('text', i) as string;
								} else if (mediaProperties.length === 1) {
									// If single media attached
									const mediaProperty = mediaProperties[0] as IDataObject;
									endpoint = 'send' + (mediaProperty.type as string).charAt(0).toUpperCase() + (mediaProperty.type as string).slice(1);
									const fileName = (mediaProperty.url as string).replace('attach://', '');
									const fileData = binaryData && binaryData[fileName] as IBinaryData;
									if (!fileData) {
										// If media is link
										body[mediaProperty.type as string] = mediaProperty.url;
									} else {
										// If media is binary
										let uploadData: Buffer | Readable;
										if (fileData.id) {
											uploadData = await this.helpers.getBinaryStream(fileData.id);
										} else {
											uploadData = Buffer.from(fileData.data, BINARY_ENCODING);
										}
										body.caption = this.getNodeParameter('text', i) as string;
										delete additionalFields.media;
										addAdditionalFields.call(this, body, i, additionalFields, inlineKeyboard);

										formData = {
											...body,
											[mediaProperty.type as string]: {
												value: uploadData,
												options: {
													filename: fileName,
													contentType: fileData.mimeType,
												},
											},
										};
										if (formData.reply_markup) {
											formData.reply_markup = JSON.stringify(formData.reply_markup);
										}
									}
									body.caption = this.getNodeParameter('text', i) as string;
								} else {
									// If multiple media attached
									endpoint = 'sendMediaGroup';
									const binaryMediaObject: any = {};
									const mediaArray: IDataObject[] = await Promise.all(
										mediaProperties.map(async mediaProperty => {
											const fileName = (mediaProperty.url as string).replace('attach://', '');
											const fileData = binaryData && binaryData[fileName] as IBinaryData;
											if (!fileData) {
												// If media is link
												return {
													type: mediaProperty.type,
													media: mediaProperty.url,
												};
											} else {
												// If media is binary
												let uploadData: Buffer | Readable;
												if (fileData.id) {
													uploadData = await this.helpers.getBinaryStream(fileData.id);
												} else {
													uploadData = Buffer.from(fileData.data, BINARY_ENCODING);
												}

												binaryMediaObject[fileName] = {
													value: uploadData,
													options: {
														filename: fileName,
														contentType: fileData.mimeType,
													},
												};
												return {
													type: mediaProperty.type,
													media: mediaProperty.url,
												};
											}
										})
									);
									delete additionalFields.media;
									addAdditionalFields.call(this, body, i, additionalFields);
									mediaArray[mediaArray.length-1].caption = this.getNodeParameter('text', i) as string;
									mediaArray[mediaArray.length-1].parse_mode = body.parse_mode;

									formData = {
										...body,
										media: JSON.stringify(mediaArray),
										...binaryMediaObject
									};
								}
							} else {
								// If edit existing message
								if (!mediaProperties?.length) {
									// If no media attached
									if (callback_query.message.photo || callback_query.message.document) {
										// If edited message have media of any kind
										endpoint = 'editMessageCaption';
										body.caption = this.getNodeParameter('text', i) as string;
									} else {
										// If edited message is text message
										endpoint = 'editMessageText';
										body.text = this.getNodeParameter('text', i) as string;
									}
								} else {
									// If single or multiple media attached. Get only first media
									endpoint = 'editMessageMedia';
									const fileName = (mediaProperties[0].url as string).replace('attach://', '');
									const fileData = binaryData && binaryData[fileName] as IBinaryData;
									if (!fileData) {
										// If media is link
										body.media = {
											type: mediaProperties[0].type,
											media: mediaProperties[0].url as string,
											caption: this.getNodeParameter('text', i) as string,
										};
										delete additionalFields.media;
									} else {
										// If media is binary
										let uploadData: Buffer | Readable;
										if (fileData.id) {
											uploadData = await this.helpers.getBinaryStream(fileData.id);
										} else {
											uploadData = Buffer.from(fileData.data, BINARY_ENCODING);
										}
										delete additionalFields.media;
										addAdditionalFields.call(this, body, i, additionalFields, inlineKeyboard);

										formData = {
											...body,
											media: JSON.stringify({
												type: mediaProperties[0].type,
												media: mediaProperties[0].url as string,
												caption: this.getNodeParameter('text', i) as string,
												parse_mode: body.parse_mode
											}),
											[fileName]: {
												value: uploadData,
												options: {
													filename: fileName,
													contentType: fileData.mimeType,
												},
											},
										};
										if (formData.reply_markup) {
											formData.reply_markup = JSON.stringify(formData.reply_markup);
										}
									}
								}
							}

							// Add additional fields and replyMarkup
							addAdditionalFields.call(this, body, i, additionalFields, inlineKeyboard);
						}
					} else {
						throw new NodeOperationError(this.getNode(), `The resource "${resource}" is not known!`, {
							itemIndex: i,
						});
					}

					let responseData = await apiRequest.call(this, requestMethod, endpoint, formData? {}:body, qs, formData? {formData} : undefined);

					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(responseData as IDataObject[]),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					returnArray[0] = returnData;
				} catch (error) {
					if (this.continueOnFail()) {
						const executionErrorData = this.helpers.constructExecutionMetaData(
							this.helpers.returnJsonArray({ error: error.description ?? error.message }),
							{ itemData: { item: i } },
						);
						returnData.push(...executionErrorData);
						continue;
					}
					throw error;
				}
			}
		}

		return returnArray;
	}
}
