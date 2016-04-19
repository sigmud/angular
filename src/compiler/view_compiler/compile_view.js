'use strict';"use strict";
var lang_1 = require('angular2/src/facade/lang');
var collection_1 = require('angular2/src/facade/collection');
var o = require('../output/output_ast');
var identifiers_1 = require('../identifiers');
var constants_1 = require('./constants');
var compile_query_1 = require('./compile_query');
var compile_method_1 = require('./compile_method');
var view_type_1 = require('angular2/src/core/linker/view_type');
var compile_metadata_1 = require('../compile_metadata');
var util_1 = require('./util');
var lifecycle_binder_1 = require('./lifecycle_binder');
var CompilePipe = (function () {
    function CompilePipe() {
    }
    return CompilePipe;
}());
exports.CompilePipe = CompilePipe;
var CompileView = (function () {
    function CompileView(component, genConfig, pipeMetas, styles, viewIndex, declarationElement, templateVariableBindings) {
        var _this = this;
        this.component = component;
        this.genConfig = genConfig;
        this.pipeMetas = pipeMetas;
        this.styles = styles;
        this.viewIndex = viewIndex;
        this.declarationElement = declarationElement;
        this.templateVariableBindings = templateVariableBindings;
        this.namedAppElements = [];
        this.nodes = [];
        this.rootNodesOrAppElements = [];
        this.bindings = [];
        this.classStatements = [];
        this.eventHandlerMethods = [];
        this.fields = [];
        this.getters = [];
        this.disposables = [];
        this.subscriptions = [];
        this.pipes = new Map();
        this.variables = new Map();
        this.literalArrayCount = 0;
        this.literalMapCount = 0;
        this.createMethod = new compile_method_1.CompileMethod(this);
        this.injectorGetMethod = new compile_method_1.CompileMethod(this);
        this.updateContentQueriesMethod = new compile_method_1.CompileMethod(this);
        this.dirtyParentQueriesMethod = new compile_method_1.CompileMethod(this);
        this.updateViewQueriesMethod = new compile_method_1.CompileMethod(this);
        this.detectChangesInInputsMethod = new compile_method_1.CompileMethod(this);
        this.detectChangesHostPropertiesMethod = new compile_method_1.CompileMethod(this);
        this.afterContentLifecycleCallbacksMethod = new compile_method_1.CompileMethod(this);
        this.afterViewLifecycleCallbacksMethod = new compile_method_1.CompileMethod(this);
        this.destroyMethod = new compile_method_1.CompileMethod(this);
        this.viewType = getViewType(component, viewIndex);
        this.className = "_View_" + component.type.name + viewIndex;
        this.classType = o.importType(new compile_metadata_1.CompileIdentifierMetadata({ name: this.className }));
        this.viewFactory = o.variable(util_1.getViewFactoryName(component, viewIndex));
        if (this.viewType === view_type_1.ViewType.COMPONENT || this.viewType === view_type_1.ViewType.HOST) {
            this.componentView = this;
        }
        else {
            this.componentView = this.declarationElement.view.componentView;
        }
        var viewQueries = new compile_metadata_1.CompileTokenMap();
        if (this.viewType === view_type_1.ViewType.COMPONENT) {
            var directiveInstance = o.THIS_EXPR.prop('context');
            collection_1.ListWrapper.forEachWithIndex(this.component.viewQueries, function (queryMeta, queryIndex) {
                var propName = "_viewQuery_" + queryMeta.selectors[0].name + "_" + queryIndex;
                var queryList = compile_query_1.createQueryList(queryMeta, directiveInstance, propName, _this);
                var query = new compile_query_1.CompileQuery(queryMeta, queryList, directiveInstance, _this);
                compile_query_1.addQueryToTokenMap(viewQueries, query);
            });
            var constructorViewQueryCount = 0;
            this.component.type.diDeps.forEach(function (dep) {
                if (lang_1.isPresent(dep.viewQuery)) {
                    var queryList = o.THIS_EXPR.prop('declarationAppElement')
                        .prop('componentConstructorViewQueries')
                        .key(o.literal(constructorViewQueryCount++));
                    var query = new compile_query_1.CompileQuery(dep.viewQuery, queryList, null, _this);
                    compile_query_1.addQueryToTokenMap(viewQueries, query);
                }
            });
        }
        this.viewQueries = viewQueries;
        templateVariableBindings.forEach(function (entry) {
            _this.variables.set(entry[1], o.THIS_EXPR.prop('locals').key(o.literal(entry[0])));
        });
        if (!this.declarationElement.isNull()) {
            this.declarationElement.setEmbeddedView(this);
        }
    }
    CompileView.prototype.createPipe = function (name) {
        var pipeMeta = this.pipeMetas.find(function (pipeMeta) { return pipeMeta.name == name; });
        var pipeFieldName = pipeMeta.pure ? "_pipe_" + name : "_pipe_" + name + "_" + this.pipes.size;
        var pipeExpr = this.pipes.get(pipeFieldName);
        if (lang_1.isBlank(pipeExpr)) {
            var deps = pipeMeta.type.diDeps.map(function (diDep) {
                if (diDep.token.equalsTo(identifiers_1.identifierToken(identifiers_1.Identifiers.ChangeDetectorRef))) {
                    return o.THIS_EXPR.prop('ref');
                }
                return util_1.injectFromViewParentInjector(diDep.token, false);
            });
            this.fields.push(new o.ClassField(pipeFieldName, o.importType(pipeMeta.type), [o.StmtModifier.Private]));
            this.createMethod.resetDebugInfo(null, null);
            this.createMethod.addStmt(o.THIS_EXPR.prop(pipeFieldName)
                .set(o.importExpr(pipeMeta.type).instantiate(deps))
                .toStmt());
            pipeExpr = o.THIS_EXPR.prop(pipeFieldName);
            this.pipes.set(pipeFieldName, pipeExpr);
            lifecycle_binder_1.bindPipeDestroyLifecycleCallbacks(pipeMeta, pipeExpr, this);
        }
        return pipeExpr;
    };
    CompileView.prototype.getVariable = function (name) {
        if (name == constants_1.EventHandlerVars.event.name) {
            return constants_1.EventHandlerVars.event;
        }
        var currView = this;
        var result = currView.variables.get(name);
        var viewPath = [];
        while (lang_1.isBlank(result) && lang_1.isPresent(currView.declarationElement.view)) {
            currView = currView.declarationElement.view;
            result = currView.variables.get(name);
            viewPath.push(currView);
        }
        if (lang_1.isPresent(result)) {
            return util_1.getPropertyInView(result, viewPath);
        }
        else {
            return null;
        }
    };
    CompileView.prototype.createLiteralArray = function (values) {
        return o.THIS_EXPR.callMethod('literalArray', [o.literal(this.literalArrayCount++), o.literalArr(values)]);
    };
    CompileView.prototype.createLiteralMap = function (values) {
        return o.THIS_EXPR.callMethod('literalMap', [o.literal(this.literalMapCount++), o.literalMap(values)]);
    };
    CompileView.prototype.afterNodes = function () {
        var _this = this;
        this.viewQueries.values().forEach(function (queries) { return queries.forEach(function (query) { return query.afterChildren(_this.updateViewQueriesMethod); }); });
    };
    return CompileView;
}());
exports.CompileView = CompileView;
function getViewType(component, embeddedTemplateIndex) {
    if (embeddedTemplateIndex > 0) {
        return view_type_1.ViewType.EMBEDDED;
    }
    else if (component.type.isHost) {
        return view_type_1.ViewType.HOST;
    }
    else {
        return view_type_1.ViewType.COMPONENT;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZV92aWV3LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlmZmluZ19wbHVnaW5fd3JhcHBlci1vdXRwdXRfcGF0aC1xMGNxUHlzVC50bXAvYW5ndWxhcjIvc3JjL2NvbXBpbGVyL3ZpZXdfY29tcGlsZXIvY29tcGlsZV92aWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxxQkFBaUMsMEJBQTBCLENBQUMsQ0FBQTtBQUM1RCwyQkFBNEMsZ0NBQWdDLENBQUMsQ0FBQTtBQUU3RSxJQUFZLENBQUMsV0FBTSxzQkFBc0IsQ0FBQyxDQUFBO0FBQzFDLDRCQUEyQyxnQkFBZ0IsQ0FBQyxDQUFBO0FBQzVELDBCQUErQixhQUFhLENBQUMsQ0FBQTtBQUM3Qyw4QkFBZ0UsaUJBQWlCLENBQUMsQ0FBQTtBQUdsRiwrQkFBNEIsa0JBQWtCLENBQUMsQ0FBQTtBQUMvQywwQkFBdUIsb0NBQW9DLENBQUMsQ0FBQTtBQUM1RCxpQ0FLTyxxQkFBcUIsQ0FBQyxDQUFBO0FBQzdCLHFCQUtPLFFBQVEsQ0FBQyxDQUFBO0FBSWhCLGlDQUFnRCxvQkFBb0IsQ0FBQyxDQUFBO0FBRXJFO0lBQ0U7SUFBZSxDQUFDO0lBQ2xCLGtCQUFDO0FBQUQsQ0FBQyxBQUZELElBRUM7QUFGWSxtQkFBVyxjQUV2QixDQUFBO0FBRUQ7SUFzQ0UscUJBQW1CLFNBQW1DLEVBQVMsU0FBeUIsRUFDckUsU0FBZ0MsRUFBUyxNQUFvQixFQUM3RCxTQUFpQixFQUFTLGtCQUFrQyxFQUM1RCx3QkFBb0M7UUF6Q3pELGlCQXFKQztRQS9Hb0IsY0FBUyxHQUFULFNBQVMsQ0FBMEI7UUFBUyxjQUFTLEdBQVQsU0FBUyxDQUFnQjtRQUNyRSxjQUFTLEdBQVQsU0FBUyxDQUF1QjtRQUFTLFdBQU0sR0FBTixNQUFNLENBQWM7UUFDN0QsY0FBUyxHQUFULFNBQVMsQ0FBUTtRQUFTLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBZ0I7UUFDNUQsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUFZ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LENBQUMsWUFBWSxFQUNaLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBRUQsZ0NBQVUsR0FBVjtRQUFBLGlCQUdDO1FBRkMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQzdCLFVBQUMsT0FBTyxJQUFLLE9BQUEsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEtBQUssSUFBSyxPQUFBLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSSxDQUFDLHVCQUF1QixDQUFDLEVBQWpELENBQWlELENBQUMsRUFBN0UsQ0FBNkUsQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFDSCxrQkFBQztBQUFELENBQUMsQUFySkQsSUFxSkM7QUFySlksbUJBQVcsY0FxSnZCLENBQUE7QUFFRCxxQkFBcUIsU0FBbUMsRUFBRSxxQkFBNkI7SUFDckYsRUFBRSxDQUFDLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QixNQUFNLENBQUMsb0JBQVEsQ0FBQyxRQUFRLENBQUM7SUFDM0IsQ0FBQztJQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDakMsTUFBTSxDQUFDLG9CQUFRLENBQUMsSUFBSSxDQUFDO0lBQ3ZCLENBQUM7SUFBQyxJQUFJLENBQUMsQ0FBQztRQUNOLE1BQU0sQ0FBQyxvQkFBUSxDQUFDLFNBQVMsQ0FBQztJQUM1QixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7aXNQcmVzZW50LCBpc0JsYW5rfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2xhbmcnO1xuaW1wb3J0IHtMaXN0V3JhcHBlciwgU3RyaW5nTWFwV3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9jb2xsZWN0aW9uJztcblxuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzLCBpZGVudGlmaWVyVG9rZW59IGZyb20gJy4uL2lkZW50aWZpZXJzJztcbmltcG9ydCB7RXZlbnRIYW5kbGVyVmFyc30gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IHtDb21waWxlUXVlcnksIGNyZWF0ZVF1ZXJ5TGlzdCwgYWRkUXVlcnlUb1Rva2VuTWFwfSBmcm9tICcuL2NvbXBpbGVfcXVlcnknO1xuaW1wb3J0IHtOYW1lUmVzb2x2ZXJ9IGZyb20gJy4vZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb21waWxlRWxlbWVudCwgQ29tcGlsZU5vZGV9IGZyb20gJy4vY29tcGlsZV9lbGVtZW50JztcbmltcG9ydCB7Q29tcGlsZU1ldGhvZH0gZnJvbSAnLi9jb21waWxlX21ldGhvZCc7XG5pbXBvcnQge1ZpZXdUeXBlfSBmcm9tICdhbmd1bGFyMi9zcmMvY29yZS9saW5rZXIvdmlld190eXBlJztcbmltcG9ydCB7XG4gIENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgQ29tcGlsZVBpcGVNZXRhZGF0YSxcbiAgQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSxcbiAgQ29tcGlsZVRva2VuTWFwXG59IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtcbiAgZ2V0Vmlld0ZhY3RvcnlOYW1lLFxuICBpbmplY3RGcm9tVmlld1BhcmVudEluamVjdG9yLFxuICBjcmVhdGVEaVRva2VuRXhwcmVzc2lvbixcbiAgZ2V0UHJvcGVydHlJblZpZXdcbn0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7Q29tcGlsZXJDb25maWd9IGZyb20gJy4uL2NvbmZpZyc7XG5pbXBvcnQge0NvbXBpbGVCaW5kaW5nfSBmcm9tICcuL2NvbXBpbGVfYmluZGluZyc7XG5cbmltcG9ydCB7YmluZFBpcGVEZXN0cm95TGlmZWN5Y2xlQ2FsbGJhY2tzfSBmcm9tICcuL2xpZmVjeWNsZV9iaW5kZXInO1xuXG5leHBvcnQgY2xhc3MgQ29tcGlsZVBpcGUge1xuICBjb25zdHJ1Y3RvcigpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlVmlldyBpbXBsZW1lbnRzIE5hbWVSZXNvbHZlciB7XG4gIHB1YmxpYyB2aWV3VHlwZTogVmlld1R5cGU7XG4gIHB1YmxpYyB2aWV3UXVlcmllczogQ29tcGlsZVRva2VuTWFwPENvbXBpbGVRdWVyeVtdPjtcbiAgcHVibGljIG5hbWVkQXBwRWxlbWVudHM6IEFycmF5PEFycmF5PHN0cmluZyB8IG8uRXhwcmVzc2lvbj4+ID0gW107XG5cbiAgcHVibGljIG5vZGVzOiBDb21waWxlTm9kZVtdID0gW107XG4gIHB1YmxpYyByb290Tm9kZXNPckFwcEVsZW1lbnRzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIHB1YmxpYyBiaW5kaW5nczogQ29tcGlsZUJpbmRpbmdbXSA9IFtdO1xuXG4gIHB1YmxpYyBjbGFzc1N0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgcHVibGljIGNyZWF0ZU1ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIGluamVjdG9yR2V0TWV0aG9kOiBDb21waWxlTWV0aG9kO1xuICBwdWJsaWMgdXBkYXRlQ29udGVudFF1ZXJpZXNNZXRob2Q6IENvbXBpbGVNZXRob2Q7XG4gIHB1YmxpYyBkaXJ0eVBhcmVudFF1ZXJpZXNNZXRob2Q6IENvbXBpbGVNZXRob2Q7XG4gIHB1YmxpYyB1cGRhdGVWaWV3UXVlcmllc01ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIGRldGVjdENoYW5nZXNJbklucHV0c01ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIGRldGVjdENoYW5nZXNIb3N0UHJvcGVydGllc01ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIGFmdGVyQ29udGVudExpZmVjeWNsZUNhbGxiYWNrc01ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIGFmdGVyVmlld0xpZmVjeWNsZUNhbGxiYWNrc01ldGhvZDogQ29tcGlsZU1ldGhvZDtcbiAgcHVibGljIGRlc3Ryb3lNZXRob2Q6IENvbXBpbGVNZXRob2Q7XG4gIHB1YmxpYyBldmVudEhhbmRsZXJNZXRob2RzOiBvLkNsYXNzTWV0aG9kW10gPSBbXTtcblxuICBwdWJsaWMgZmllbGRzOiBvLkNsYXNzRmllbGRbXSA9IFtdO1xuICBwdWJsaWMgZ2V0dGVyczogby5DbGFzc0dldHRlcltdID0gW107XG4gIHB1YmxpYyBkaXNwb3NhYmxlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgcHVibGljIHN1YnNjcmlwdGlvbnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgcHVibGljIGNvbXBvbmVudFZpZXc6IENvbXBpbGVWaWV3O1xuICBwdWJsaWMgcGlwZXMgPSBuZXcgTWFwPHN0cmluZywgby5FeHByZXNzaW9uPigpO1xuICBwdWJsaWMgdmFyaWFibGVzID0gbmV3IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4oKTtcbiAgcHVibGljIGNsYXNzTmFtZTogc3RyaW5nO1xuICBwdWJsaWMgY2xhc3NUeXBlOiBvLlR5cGU7XG4gIHB1YmxpYyB2aWV3RmFjdG9yeTogby5SZWFkVmFyRXhwcjtcblxuICBwdWJsaWMgbGl0ZXJhbEFycmF5Q291bnQgPSAwO1xuICBwdWJsaWMgbGl0ZXJhbE1hcENvdW50ID0gMDtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHB1YmxpYyBnZW5Db25maWc6IENvbXBpbGVyQ29uZmlnLFxuICAgICAgICAgICAgICBwdWJsaWMgcGlwZU1ldGFzOiBDb21waWxlUGlwZU1ldGFkYXRhW10sIHB1YmxpYyBzdHlsZXM6IG8uRXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgcHVibGljIHZpZXdJbmRleDogbnVtYmVyLCBwdWJsaWMgZGVjbGFyYXRpb25FbGVtZW50OiBDb21waWxlRWxlbWVudCxcbiAgICAgICAgICAgICAgcHVibGljIHRlbXBsYXRlVmFyaWFibGVCaW5kaW5nczogc3RyaW5nW11bXSkge1xuICAgIHRoaXMuY3JlYXRlTWV0aG9kID0gbmV3IENvbXBpbGVNZXRob2QodGhpcyk7XG4gICAgdGhpcy5pbmplY3RvckdldE1ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuICAgIHRoaXMudXBkYXRlQ29udGVudFF1ZXJpZXNNZXRob2QgPSBuZXcgQ29tcGlsZU1ldGhvZCh0aGlzKTtcbiAgICB0aGlzLmRpcnR5UGFyZW50UXVlcmllc01ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuICAgIHRoaXMudXBkYXRlVmlld1F1ZXJpZXNNZXRob2QgPSBuZXcgQ29tcGlsZU1ldGhvZCh0aGlzKTtcbiAgICB0aGlzLmRldGVjdENoYW5nZXNJbklucHV0c01ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuICAgIHRoaXMuZGV0ZWN0Q2hhbmdlc0hvc3RQcm9wZXJ0aWVzTWV0aG9kID0gbmV3IENvbXBpbGVNZXRob2QodGhpcyk7XG5cbiAgICB0aGlzLmFmdGVyQ29udGVudExpZmVjeWNsZUNhbGxiYWNrc01ldGhvZCA9IG5ldyBDb21waWxlTWV0aG9kKHRoaXMpO1xuICAgIHRoaXMuYWZ0ZXJWaWV3TGlmZWN5Y2xlQ2FsbGJhY2tzTWV0aG9kID0gbmV3IENvbXBpbGVNZXRob2QodGhpcyk7XG4gICAgdGhpcy5kZXN0cm95TWV0aG9kID0gbmV3IENvbXBpbGVNZXRob2QodGhpcyk7XG5cbiAgICB0aGlzLnZpZXdUeXBlID0gZ2V0Vmlld1R5cGUoY29tcG9uZW50LCB2aWV3SW5kZXgpO1xuICAgIHRoaXMuY2xhc3NOYW1lID0gYF9WaWV3XyR7Y29tcG9uZW50LnR5cGUubmFtZX0ke3ZpZXdJbmRleH1gO1xuICAgIHRoaXMuY2xhc3NUeXBlID0gby5pbXBvcnRUeXBlKG5ldyBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhKHtuYW1lOiB0aGlzLmNsYXNzTmFtZX0pKTtcbiAgICB0aGlzLnZpZXdGYWN0b3J5ID0gby52YXJpYWJsZShnZXRWaWV3RmFjdG9yeU5hbWUoY29tcG9uZW50LCB2aWV3SW5kZXgpKTtcbiAgICBpZiAodGhpcy52aWV3VHlwZSA9PT0gVmlld1R5cGUuQ09NUE9ORU5UIHx8IHRoaXMudmlld1R5cGUgPT09IFZpZXdUeXBlLkhPU1QpIHtcbiAgICAgIHRoaXMuY29tcG9uZW50VmlldyA9IHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29tcG9uZW50VmlldyA9IHRoaXMuZGVjbGFyYXRpb25FbGVtZW50LnZpZXcuY29tcG9uZW50VmlldztcbiAgICB9XG4gICAgdmFyIHZpZXdRdWVyaWVzID0gbmV3IENvbXBpbGVUb2tlbk1hcDxDb21waWxlUXVlcnlbXT4oKTtcbiAgICBpZiAodGhpcy52aWV3VHlwZSA9PT0gVmlld1R5cGUuQ09NUE9ORU5UKSB7XG4gICAgICB2YXIgZGlyZWN0aXZlSW5zdGFuY2UgPSBvLlRISVNfRVhQUi5wcm9wKCdjb250ZXh0Jyk7XG4gICAgICBMaXN0V3JhcHBlci5mb3JFYWNoV2l0aEluZGV4KHRoaXMuY29tcG9uZW50LnZpZXdRdWVyaWVzLCAocXVlcnlNZXRhLCBxdWVyeUluZGV4KSA9PiB7XG4gICAgICAgIHZhciBwcm9wTmFtZSA9IGBfdmlld1F1ZXJ5XyR7cXVlcnlNZXRhLnNlbGVjdG9yc1swXS5uYW1lfV8ke3F1ZXJ5SW5kZXh9YDtcbiAgICAgICAgdmFyIHF1ZXJ5TGlzdCA9IGNyZWF0ZVF1ZXJ5TGlzdChxdWVyeU1ldGEsIGRpcmVjdGl2ZUluc3RhbmNlLCBwcm9wTmFtZSwgdGhpcyk7XG4gICAgICAgIHZhciBxdWVyeSA9IG5ldyBDb21waWxlUXVlcnkocXVlcnlNZXRhLCBxdWVyeUxpc3QsIGRpcmVjdGl2ZUluc3RhbmNlLCB0aGlzKTtcbiAgICAgICAgYWRkUXVlcnlUb1Rva2VuTWFwKHZpZXdRdWVyaWVzLCBxdWVyeSk7XG4gICAgICB9KTtcbiAgICAgIHZhciBjb25zdHJ1Y3RvclZpZXdRdWVyeUNvdW50ID0gMDtcbiAgICAgIHRoaXMuY29tcG9uZW50LnR5cGUuZGlEZXBzLmZvckVhY2goKGRlcCkgPT4ge1xuICAgICAgICBpZiAoaXNQcmVzZW50KGRlcC52aWV3UXVlcnkpKSB7XG4gICAgICAgICAgdmFyIHF1ZXJ5TGlzdCA9IG8uVEhJU19FWFBSLnByb3AoJ2RlY2xhcmF0aW9uQXBwRWxlbWVudCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcCgnY29tcG9uZW50Q29uc3RydWN0b3JWaWV3UXVlcmllcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAua2V5KG8ubGl0ZXJhbChjb25zdHJ1Y3RvclZpZXdRdWVyeUNvdW50KyspKTtcbiAgICAgICAgICB2YXIgcXVlcnkgPSBuZXcgQ29tcGlsZVF1ZXJ5KGRlcC52aWV3UXVlcnksIHF1ZXJ5TGlzdCwgbnVsbCwgdGhpcyk7XG4gICAgICAgICAgYWRkUXVlcnlUb1Rva2VuTWFwKHZpZXdRdWVyaWVzLCBxdWVyeSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLnZpZXdRdWVyaWVzID0gdmlld1F1ZXJpZXM7XG4gICAgdGVtcGxhdGVWYXJpYWJsZUJpbmRpbmdzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICB0aGlzLnZhcmlhYmxlcy5zZXQoZW50cnlbMV0sIG8uVEhJU19FWFBSLnByb3AoJ2xvY2FscycpLmtleShvLmxpdGVyYWwoZW50cnlbMF0pKSk7XG4gICAgfSk7XG5cbiAgICBpZiAoIXRoaXMuZGVjbGFyYXRpb25FbGVtZW50LmlzTnVsbCgpKSB7XG4gICAgICB0aGlzLmRlY2xhcmF0aW9uRWxlbWVudC5zZXRFbWJlZGRlZFZpZXcodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlUGlwZShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIHZhciBwaXBlTWV0YTogQ29tcGlsZVBpcGVNZXRhZGF0YSA9IHRoaXMucGlwZU1ldGFzLmZpbmQoKHBpcGVNZXRhKSA9PiBwaXBlTWV0YS5uYW1lID09IG5hbWUpO1xuICAgIHZhciBwaXBlRmllbGROYW1lID0gcGlwZU1ldGEucHVyZSA/IGBfcGlwZV8ke25hbWV9YCA6IGBfcGlwZV8ke25hbWV9XyR7dGhpcy5waXBlcy5zaXplfWA7XG4gICAgdmFyIHBpcGVFeHByID0gdGhpcy5waXBlcy5nZXQocGlwZUZpZWxkTmFtZSk7XG4gICAgaWYgKGlzQmxhbmsocGlwZUV4cHIpKSB7XG4gICAgICB2YXIgZGVwcyA9IHBpcGVNZXRhLnR5cGUuZGlEZXBzLm1hcCgoZGlEZXApID0+IHtcbiAgICAgICAgaWYgKGRpRGVwLnRva2VuLmVxdWFsc1RvKGlkZW50aWZpZXJUb2tlbihJZGVudGlmaWVycy5DaGFuZ2VEZXRlY3RvclJlZikpKSB7XG4gICAgICAgICAgcmV0dXJuIG8uVEhJU19FWFBSLnByb3AoJ3JlZicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbmplY3RGcm9tVmlld1BhcmVudEluamVjdG9yKGRpRGVwLnRva2VuLCBmYWxzZSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuZmllbGRzLnB1c2goXG4gICAgICAgICAgbmV3IG8uQ2xhc3NGaWVsZChwaXBlRmllbGROYW1lLCBvLmltcG9ydFR5cGUocGlwZU1ldGEudHlwZSksIFtvLlN0bXRNb2RpZmllci5Qcml2YXRlXSkpO1xuICAgICAgdGhpcy5jcmVhdGVNZXRob2QucmVzZXREZWJ1Z0luZm8obnVsbCwgbnVsbCk7XG4gICAgICB0aGlzLmNyZWF0ZU1ldGhvZC5hZGRTdG10KG8uVEhJU19FWFBSLnByb3AocGlwZUZpZWxkTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQoby5pbXBvcnRFeHByKHBpcGVNZXRhLnR5cGUpLmluc3RhbnRpYXRlKGRlcHMpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RtdCgpKTtcbiAgICAgIHBpcGVFeHByID0gby5USElTX0VYUFIucHJvcChwaXBlRmllbGROYW1lKTtcbiAgICAgIHRoaXMucGlwZXMuc2V0KHBpcGVGaWVsZE5hbWUsIHBpcGVFeHByKTtcbiAgICAgIGJpbmRQaXBlRGVzdHJveUxpZmVjeWNsZUNhbGxiYWNrcyhwaXBlTWV0YSwgcGlwZUV4cHIsIHRoaXMpO1xuICAgIH1cbiAgICByZXR1cm4gcGlwZUV4cHI7XG4gIH1cblxuICBnZXRWYXJpYWJsZShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmIChuYW1lID09IEV2ZW50SGFuZGxlclZhcnMuZXZlbnQubmFtZSkge1xuICAgICAgcmV0dXJuIEV2ZW50SGFuZGxlclZhcnMuZXZlbnQ7XG4gICAgfVxuICAgIHZhciBjdXJyVmlldzogQ29tcGlsZVZpZXcgPSB0aGlzO1xuICAgIHZhciByZXN1bHQgPSBjdXJyVmlldy52YXJpYWJsZXMuZ2V0KG5hbWUpO1xuICAgIHZhciB2aWV3UGF0aCA9IFtdO1xuICAgIHdoaWxlIChpc0JsYW5rKHJlc3VsdCkgJiYgaXNQcmVzZW50KGN1cnJWaWV3LmRlY2xhcmF0aW9uRWxlbWVudC52aWV3KSkge1xuICAgICAgY3VyclZpZXcgPSBjdXJyVmlldy5kZWNsYXJhdGlvbkVsZW1lbnQudmlldztcbiAgICAgIHJlc3VsdCA9IGN1cnJWaWV3LnZhcmlhYmxlcy5nZXQobmFtZSk7XG4gICAgICB2aWV3UGF0aC5wdXNoKGN1cnJWaWV3KTtcbiAgICB9XG4gICAgaWYgKGlzUHJlc2VudChyZXN1bHQpKSB7XG4gICAgICByZXR1cm4gZ2V0UHJvcGVydHlJblZpZXcocmVzdWx0LCB2aWV3UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUxpdGVyYWxBcnJheSh2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gby5USElTX0VYUFIuY2FsbE1ldGhvZCgnbGl0ZXJhbEFycmF5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbby5saXRlcmFsKHRoaXMubGl0ZXJhbEFycmF5Q291bnQrKyksIG8ubGl0ZXJhbEFycih2YWx1ZXMpXSk7XG4gIH1cbiAgY3JlYXRlTGl0ZXJhbE1hcCh2YWx1ZXM6IEFycmF5PEFycmF5PHN0cmluZyB8IG8uRXhwcmVzc2lvbj4+KTogby5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gby5USElTX0VYUFIuY2FsbE1ldGhvZCgnbGl0ZXJhbE1hcCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW28ubGl0ZXJhbCh0aGlzLmxpdGVyYWxNYXBDb3VudCsrKSwgby5saXRlcmFsTWFwKHZhbHVlcyldKTtcbiAgfVxuXG4gIGFmdGVyTm9kZXMoKSB7XG4gICAgdGhpcy52aWV3UXVlcmllcy52YWx1ZXMoKS5mb3JFYWNoKFxuICAgICAgICAocXVlcmllcykgPT4gcXVlcmllcy5mb3JFYWNoKChxdWVyeSkgPT4gcXVlcnkuYWZ0ZXJDaGlsZHJlbih0aGlzLnVwZGF0ZVZpZXdRdWVyaWVzTWV0aG9kKSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFZpZXdUeXBlKGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBlbWJlZGRlZFRlbXBsYXRlSW5kZXg6IG51bWJlcik6IFZpZXdUeXBlIHtcbiAgaWYgKGVtYmVkZGVkVGVtcGxhdGVJbmRleCA+IDApIHtcbiAgICByZXR1cm4gVmlld1R5cGUuRU1CRURERUQ7XG4gIH0gZWxzZSBpZiAoY29tcG9uZW50LnR5cGUuaXNIb3N0KSB7XG4gICAgcmV0dXJuIFZpZXdUeXBlLkhPU1Q7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFZpZXdUeXBlLkNPTVBPTkVOVDtcbiAgfVxufVxuIl19