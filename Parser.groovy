import org.codehaus.groovy.control.CompilerConfiguration
import org.codehaus.groovy.control.ErrorCollector
import org.codehaus.groovy.control.SourceUnit
import org.codehaus.groovy.ast.expr.Expression
import org.codehaus.groovy.ast.ClassNode
import org.codehaus.groovy.ast.AnnotationNode
import org.codehaus.groovy.ast.MethodNode
import org.codehaus.groovy.ast.Parameter
import java.nio.file.Path
import java.nio.file.Paths
import groovy.json.JsonOutput

class AnnotationJson {
  String name
  List<String> values
}
class ParameterJson {
  String name
  String type
  List<AnnotationJson> annotations
}
class MethodJson {
  String name
  List<AnnotationJson> annotations
  List<ParameterJson> parameters
}
class ClassJson {
  List<AnnotationJson> annotations
  List<MethodJson> methods
}

static String getMemberValue(String name, Expression exp) {
  return exp.getText()
}
static AnnotationJson convertAnnotation(AnnotationNode node) {
  def json = new AnnotationJson()
  json.name = node.getClassNode().getName()
  json.values = node.getMembers().collect(Parser.&getMemberValue)
  return json
}
static ParameterJson convertParameter(Parameter node) {
  def json = new ParameterJson()
  json.annotations = node.getAnnotations().collect(Parser.&convertAnnotation)
  json.name = node.getName()
  json.type = node.getType().getName()
  return json
}
static MethodJson convertMethod(MethodNode node) {
  def json = new MethodJson()
  json.annotations = node.getAnnotations().collect(Parser.&convertAnnotation)
  json.name = node.getName()
  json.parameters = node.getParameters().collect(Parser.&convertParameter)
  return json
}
static ClassJson convertClass(ClassNode node) {
  def json = new ClassJson()
  json.annotations = node.getAnnotations().collect(Parser.&convertAnnotation)
  json.methods = node.getMethods().collect(Parser.&convertMethod)
  return json
}

public static void main(String[] args) {
  if(args.length == 0) {
    println "Filename required"
    return
  }
  File file = new File(args[0])
  GroovyClassLoader classLoader = new GroovyClassLoader()
  def collector = new ErrorCollector()
  def conf = new CompilerConfiguration()
  conf.setRecompileGroovySource(false)
  def sourceUnit = new SourceUnit(file, conf, classLoader, collector)
  sourceUnit.parse()
  sourceUnit.buildAST()
  def moduleNode = sourceUnit.getAST()
  List<ClassJson> json = moduleNode.getClasses().collect(Parser.&convertClass)
  println JsonOutput.toJson(json)
}