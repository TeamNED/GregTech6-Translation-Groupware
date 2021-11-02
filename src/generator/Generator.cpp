#include "Generator.hpp"

Generator::Generator(shared_ptr<IGeneratorMeta> meta) : _meta(meta){};

shared_ptr<IGeneratorMeta> &Generator::meta() { return this->_meta; }
shared_ptr<IGeneratorMeta> Generator::meta() const { return this->_meta; }

vector<shared_ptr<ILangResult>>
Generator::results(IGroupRepository *repo) const {
  return vector<shared_ptr<ILangResult>>{};
}